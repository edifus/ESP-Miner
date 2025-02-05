import { Component } from '@angular/core';
import { interval, map, Observable, shareReplay, startWith, switchMap, tap } from 'rxjs';
import { HashSuffixPipe } from 'src/app/pipes/hash-suffix.pipe';
import { SystemService } from 'src/app/services/system.service';
import { ThemeService } from 'src/app/services/theme.service';
import { eASICModel } from 'src/models/enum/eASICModel';
import { ISystemInfo } from 'src/models/ISystemInfo';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent {

  public info$!: Observable<ISystemInfo>;
  public quickLink$!: Observable<string | undefined>;
  public fallbackQuickLink$!: Observable<string | undefined>;
  public expectedHashRate$!: Observable<number | undefined>;


  public chartOptions: any;
  public dataLabel: number[] = [];
  public hashrateData: number[] = [];
  public asicTempData: number[] = [];
  public vrTempData: number[] = [];
  public dataDataAverage: number[] = [];
  public chartData?: any;

  public maxPower: number = 50;
  public maxAsicTemp: number = 75;
  public maxVrTemp: number = 100;
  public maxFrequency: number = 1200;

  constructor(
    private systemService: SystemService,
    private themeService: ThemeService
  ) {
    this.initializeChart();

    // Subscribe to theme changes
    this.themeService.getThemeSettings().subscribe(() => {
      this.updateChartColors();
    });
  }

  private updateChartColors() {
    const documentStyle = getComputedStyle(document.documentElement);
    const textColor = documentStyle.getPropertyValue('--text-color');
    const textColorSecondary = documentStyle.getPropertyValue('--text-color-secondary');
    const surfaceBorder = documentStyle.getPropertyValue('--surface-border');
    const primaryColor = documentStyle.getPropertyValue('--primary-color');

    // Update chart colors
    if (this.chartData && this.chartData.datasets) {
      this.chartData.datasets[0].backgroundColor = primaryColor + '30';
      this.chartData.datasets[0].borderColor = primaryColor;
      this.chartData.datasets[1].backgroundColor = primaryColor + '30';
      this.chartData.datasets[1].borderColor = primaryColor + '60';
      this.chartData.datasets[2].backgroundColor = textColorSecondary;
      this.chartData.datasets[2].borderColor = textColorSecondary;
      this.chartData.datasets[3].backgroundColor = textColorSecondary;
      this.chartData.datasets[3].borderColor = textColorSecondary;
    }

    // Update chart options
    if (this.chartOptions) {
      this.chartOptions.plugins.legend.labels.color = textColor;
      this.chartOptions.scales.x.ticks.color = textColorSecondary;
      this.chartOptions.scales.x.grid.color = surfaceBorder;
      this.chartOptions.scales.y.ticks.color = textColorSecondary;
      this.chartOptions.scales.y.grid.color = surfaceBorder;
      this.chartOptions.scales.y2.ticks.color = textColorSecondary;
      this.chartOptions.scales.y2.grid.color = surfaceBorder;
    }

    // Force chart update
    this.chartData = { ...this.chartData };
  }

  private initializeChart() {
    const documentStyle = getComputedStyle(document.documentElement);
    const textColor = documentStyle.getPropertyValue('--text-color');
    const textColorSecondary = documentStyle.getPropertyValue('--text-color-secondary');
    const surfaceBorder = documentStyle.getPropertyValue('--surface-border');
    const primaryColor = documentStyle.getPropertyValue('--primary-color');

    this.chartData = {
      labels: [],
      datasets: [
        {
          type: 'line',
          label: 'Hashrate',
          data: [],
          fill: true,
          backgroundColor: primaryColor + '30',
          borderColor: primaryColor,
          tension: 0,
          pointRadius: 2,
          pointHoverRadius: 5,
          borderWidth: 1,
          yAxisID: 'y',
        },
        {
          type: 'line',
          label: 'Average Hashrate',
          data: [],
          fill: false,
          backgroundColor: primaryColor + '30',
          borderColor: primaryColor + '60',
          tension: 0,
          pointRadius: 0,
          borderWidth: 2,
          borderDash: [5, 5],
          yAxisID: 'y',
        },
        {
          type: 'line',
          label: 'ASIC Temp',
          data: [],
          fill: false,
          backgroundColor: textColorSecondary,
          borderColor: textColorSecondary,
          tension: 0,
          pointRadius: 2,
          pointHoverRadius: 5,
          borderWidth: 1,
          yAxisID: 'y2',
        },
        {
          type: 'line',
          label: 'VR Temp',
          data: [],
          fill: false,
          backgroundColor: textColorSecondary,
          borderColor: textColorSecondary,
          tension: 0,
          pointRadius: 0,
          pointHoverRadius: 5,
          borderWidth: 2,
          borderDash: [5, 5],
          yAxisID: 'y2',
        }
      ]
    };

    this.chartOptions = {
      animation: false,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: textColor
          }
        },
        tooltip: {
          callbacks: {
            label: function (tooltipItem: any) {
              let label = tooltipItem.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if ((tooltipItem.dataset.label === 'ASIC Temp') || (tooltipItem.dataset.label === 'VR Temp')) {
                label += tooltipItem.raw + '°C';
              } else {
                label += HashSuffixPipe.transform(tooltipItem.raw);
              }
              return label;
            }
          }
        },
      },
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'hour', // Set the unit to 'minute'
          },
          ticks: {
            color: textColorSecondary
          },
          grid: {
            color: surfaceBorder,
            drawBorder: false,
            display: true
          }
        },
        y: {
          ticks: {
            color: textColorSecondary,
            callback: (value: number) => HashSuffixPipe.transform(value)
          },
          grid: {
            color: surfaceBorder,
            drawBorder: false
          }
        },
        y2: {
          type: 'linear',
          display: true,
          position: 'right',
          ticks: {
            color: textColorSecondary,
            callback: (value: number) => value + '°C'
          },
          grid: {
            drawOnChartArea: false,
            color: surfaceBorder
          },
          suggestedMax: 80
        }
      }
    };


    this.info$ = interval(5000).pipe(
      startWith(() => this.systemService.getInfo()),
      switchMap(() => {
        return this.systemService.getInfo()
      }),
      tap(info => {
        this.hashrateData.push(info.hashRate * 1000000000);
        this.asicTempData.push(info.temp);
        this.vrTempData.push(info.vrTemp);

        this.dataLabel.push(new Date().getTime());

        if (this.hashrateData.length >= 720) {
          this.hashrateData.shift();
          this.asicTempData.shift();
          this.vrTempData.shift();
          this.dataLabel.shift();
        }

        this.chartData.labels = this.dataLabel;
        this.chartData.datasets[0].data = this.hashrateData;
        this.chartData.datasets[2].data = this.asicTempData;
        this.chartData.datasets[3].data = this.vrTempData;

        // Calculate average hashrate and fill the array with the same value for the average line
        const averageHashrate = this.calculateAverage(this.hashrateData);
        this.chartData.datasets[1].data = Array(this.hashrateData.length).fill(averageHashrate);

        this.chartData = {
          ...this.chartData
        };

        this.maxPower = Math.max(50, info.power);
        this.maxAsicTemp = Math.max(75, info.temp);
        this.maxVrTemp = Math.max(100, info.vrTemp);
        this.maxFrequency = Math.max(1200, info.frequency);

      }),
      map(info => {
        info.power = parseFloat(info.power.toFixed(1))
        info.voltage = parseFloat((info.voltage / 1000).toFixed(1));
        info.current = parseFloat((info.current / 1000).toFixed(1));
        info.coreVoltageActual = parseFloat((info.coreVoltageActual / 1000).toFixed(2));
        info.coreVoltage = parseFloat((info.coreVoltage / 1000).toFixed(2));
        info.temp = parseFloat(info.temp.toFixed(1));
        info.vrTemp = parseFloat(info.vrTemp.toFixed(1));

        return info;
      }),
      shareReplay({ refCount: true, bufferSize: 1 })
    );

    this.expectedHashRate$ = this.info$.pipe(map(info => {
      return Math.floor(info.frequency * ((info.smallCoreCount * info.asicCount) / 1000))
    }))

    this.quickLink$ = this.info$.pipe(
      map(info => this.getQuickLink(info.stratumURL, info.stratumUser))
    );

    this.fallbackQuickLink$ = this.info$.pipe(
      map(info => this.getQuickLink(info.fallbackStratumURL, info.fallbackStratumUser))
    );

  }

  private calculateAverage(data: number[]): number {
    if (data.length === 0) return 0;
    const sum = data.reduce((sum, value) => sum + value, 0);
    return sum / data.length;
  }

  private getQuickLink(stratumURL: string, stratumUser: string): string | undefined {
    const address = stratumUser.split('.')[0];

    if (stratumURL.includes('public-pool.io')) {
      return `https://web.public-pool.io/#/app/${address}`;
    } else if (stratumURL.includes('ocean.xyz')) {
      return `https://ocean.xyz/stats/${address}`;
    } else if (stratumURL.includes('solo.d-central.tech')) {
      return `https://solo.d-central.tech/#/app/${address}`;
    } else if (/^eusolo[46]?.ckpool.org/.test(stratumURL)) {
      return `https://eusolostats.ckpool.org/users/${address}`;
    } else if (/^solo[46]?.ckpool.org/.test(stratumURL)) {
      return `https://solostats.ckpool.org/users/${address}`;
    } else if (stratumURL.includes('pool.noderunners.network')) {
      return `https://noderunners.network/en/pool/user/${address}`;
    } else if (stratumURL.includes('satoshiradio.nl')) {
      return `https://pool.satoshiradio.nl/user/${address}`;
    } else if (stratumURL.includes('solohash.co.uk')) {
      return `https://solohash.co.uk/user/${address}`;
    }
    return stratumURL.startsWith('http') ? stratumURL : `http://${stratumURL}`;
  }
}
