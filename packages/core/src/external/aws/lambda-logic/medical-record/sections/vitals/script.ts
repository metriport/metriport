export function vitalScript() {
  return `
        const dates = [
            '2023-10-01', '2023-10-02', '2023-10-03', '2023-10-04', '2023-10-05',
            '2023-10-06', '2023-10-07', '2023-10-08', '2023-10-09', '2023-10-10',
            '2023-10-11', '2023-10-12', '2023-10-13', '2023-10-14', '2023-10-15',
            '2023-10-16', '2023-10-17', '2023-10-18', '2023-10-19', '2023-10-20'
        ];

        const createChart = (ctx, label, data, yAxisMin, yAxisMax, color) => {
            return new Chart(ctx, {
                type: 'line',
                data: {
                    labels: dates,
                    datasets: [{
                        label: label,
                        data: data,
                        borderColor: color,
                        backgroundColor: color + '33',
                        tension: 0.1,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                        }
                    },
                    scales: {
                        x: {
                            display: true,
                            title: {
                                display: true,
                                text: 'Date'
                            },
                            ticks: {
                                maxTicksLimit: 5
                            }
                        },
                        y: {
                            display: true,
                            title: {
                                display: true,
                                text: label
                            },
                            min: yAxisMin,
                            max: yAxisMax
                        }
                    }
                }
            });
        };

        // Oxygen Saturation
        createChart(
            document.getElementById('oxygenSaturationChart').getContext('2d'),
            'Oxygen Saturation (%)',
            [98, 97, 99, 96, 98, 95, 97, 98, 99, 96, 97, 98, 95, 96, 97, 98, 99, 97, 98, 96],
            85,
            100,
            '#748df0'
        );

        // Temperature
        createChart(
            document.getElementById('temperatureChart').getContext('2d'),
            'Temperature (°C)',
            [37.2, 37.5, 37.1, 37.3, 37.6, 37.4, 37.2, 37.5, 37.3, 37.1, 37.4, 37.2, 37.5, 37.3, 37.6, 37.4, 37.2, 37.5, 37.3, 37.1],
            36,
            38,
            '#f07474'
        );

        // Blood Pressure
        const bpCtx = document.getElementById('bloodPressureChart').getContext('2d');
        new Chart(bpCtx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Systolic',
                    data: [120, 118, 122, 119, 121, 120, 118, 122, 119, 121, 120, 118, 122, 119, 121, 120, 118, 122, 119, 121],
                    borderColor: '#748df0',
                    backgroundColor: '#748df033',
                    tension: 0.1,
                    fill: false
                },
                {
                    label: 'Diastolic',
                    data: [80, 78, 82, 79, 81, 80, 78, 82, 79, 81, 80, 78, 82, 79, 81, 80, 78, 82, 79, 81],
                    borderColor: '#f07474',
                    backgroundColor: '#f0747433',
                    tension: 0.1,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Date'
                        },
                        ticks: {
                            maxTicksLimit: 5
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Blood Pressure (mmHg)'
                        },
                        min: 40,
                        max: 160
                    }
                }
            }
        });

        // Respiratory Rate
        createChart(
            document.getElementById('respiratoryRateChart').getContext('2d'),
            'Respiratory Rate (per minute)',
            [16, 18, 17, 16, 18, 17, 16, 18, 17, 16, 18, 17, 16, 18, 17, 16, 18, 17, 16, 18],
            10,
            25,
            '#74f0b9'
        );

        // Heart Rate
        createChart(
            document.getElementById('heartRateChart').getContext('2d'),
            'Heart Rate (BPM)',
            [72, 75, 70, 73, 76, 74, 72, 75, 73, 71, 74, 72, 75, 73, 76, 74, 72, 75, 73, 71],
            50,
            100,
            '#f0c674'
        );
    `;
}
