#include <stdint.h>
#include <pthread.h>
#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "statistics_task.h"
#include "global_state.h"
#include "nvs_config.h"
#include "power.h"
#include "connect.h"
#include "vcore.h"

#define DEFAULT_POLL_RATE 5000

static const char * TAG = "statistics_task";

static StatisticsNodePtr statisticsDataStart = NULL;
static StatisticsNodePtr statisticsDataEnd = NULL;
static pthread_mutex_t statisticsDataLock = PTHREAD_MUTEX_INITIALIZER;

static const uint16_t maxDataCount = 720;
static uint16_t currentDataCount;
static uint16_t statsFrequency;

StatisticsNodePtr addStatisticData(StatisticsNodePtr data)
{
    if ((NULL == data) || (0 == statsFrequency)) {
        return NULL;
    }

    StatisticsNodePtr newData = NULL;

    // create new data block or reuse first data block
    if (currentDataCount < maxDataCount) {
        newData = (StatisticsNodePtr)malloc(sizeof(struct StatisticsData));
        currentDataCount++;
    } else {
        newData = statisticsDataStart;
    }

    // set data
    if (NULL != newData) {
        pthread_mutex_lock(&statisticsDataLock);

        if (NULL == statisticsDataStart) {
            statisticsDataStart = newData; // set first new data block
        } else {
            if ((statisticsDataStart == newData) && (NULL != statisticsDataStart->next)) {
                statisticsDataStart = statisticsDataStart->next; // move DataStart to next (first data block reused)
            }
        }

        *newData = *data;
        newData->next = NULL;

        if ((NULL != statisticsDataEnd) && (newData != statisticsDataEnd)) {
            statisticsDataEnd->next = newData; // link data block
        }
        statisticsDataEnd = newData; // set DataEnd to new data

        pthread_mutex_unlock(&statisticsDataLock);
    }

    return newData;
}

StatisticsNextNodePtr statisticData(StatisticsNodePtr nodeIn, StatisticsNodePtr dataOut)
{
    if ((NULL == nodeIn) || (NULL == dataOut) || (0 == statsFrequency)) {
        return NULL;
    }

    StatisticsNextNodePtr nextNode = NULL;

    pthread_mutex_lock(&statisticsDataLock);

    *dataOut = *nodeIn;
    nextNode = nodeIn->next;

    pthread_mutex_unlock(&statisticsDataLock);

    return nextNode;
}

void statistics_init(void * pvParameters)
{
    GlobalState * GLOBAL_STATE = (GlobalState *) pvParameters;
    GLOBAL_STATE->STATISTICS_MODULE.statisticsList = &statisticsDataStart;
}

void statistics_task(void * pvParameters)
{
    ESP_LOGI(TAG, "Starting");

    GlobalState * GLOBAL_STATE = (GlobalState *) pvParameters;
    SystemModule * sys_module = &GLOBAL_STATE->SYSTEM_MODULE;
    PowerManagementModule * power_management = &GLOBAL_STATE->POWER_MANAGEMENT_MODULE;
    struct StatisticsData statsData = {};

    TickType_t taskWakeTime = xTaskGetTickCount();

    while (1) {
        const int64_t currentTime = esp_timer_get_time() / 1000;
        statsFrequency = nvs_config_get_u16(NVS_CONFIG_STATISTICS_FREQUENCY, 0) * 1000;
        const int64_t waitingTime = statsData.timestamp + statsFrequency - (DEFAULT_POLL_RATE / 2);

        if ((0 != statsFrequency) && (currentTime > waitingTime)) {
            int8_t wifiRSSI = -90;
            get_wifi_current_rssi(&wifiRSSI);

            statsData.timestamp = currentTime;
            statsData.hashrate = sys_module->current_hashrate;
            statsData.chipTemperature = power_management->chip_temp_avg;
            statsData.vrTemperature = power_management->vr_temp;
            statsData.power = power_management->power;
            statsData.voltage = power_management->voltage;
            statsData.current = Power_get_current(GLOBAL_STATE);
            statsData.coreVoltageActual = VCORE_get_voltage_mv(GLOBAL_STATE);
            statsData.fanSpeed = power_management->fan_perc;
            statsData.fanRPM = power_management->fan_rpm;
            statsData.wifiRSSI = wifiRSSI;
            statsData.freeHeap = esp_get_free_heap_size();

            addStatisticData(&statsData);
        }

        vTaskDelayUntil(&taskWakeTime, DEFAULT_POLL_RATE / portTICK_PERIOD_MS); // taskWakeTime is automatically updated
    }
}
