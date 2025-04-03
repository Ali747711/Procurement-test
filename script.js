// DOM Elements
const fileInput = document.getElementById('csv-upload');
const fileNameDisplay = document.getElementById('file-name');
const analyzeBtn = document.getElementById('analyze-btn');
const resultsSection = document.getElementById('results');
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');
const homeBtn = document.getElementById('home-btn');

// Global variables
let parsedData = null;
let processedData = null;
let charts = {};

// ====== Event Listeners ======
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

// File upload handler
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        fileNameDisplay.textContent = file.name;
        analyzeBtn.disabled = false;
    } else {
        fileNameDisplay.textContent = 'No file selected';
        analyzeBtn.disabled = true;
    }
});

// Analyze button handler
analyzeBtn.addEventListener('click', () => {
    const file = fileInput.files[0];
    if (file) {
        parseCSV(file);
    }
});

// Tab switching
tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const tabId = button.getAttribute('data-tab');
        
        // Update active tab button
        tabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        // Update active tab content
        tabContents.forEach(content => {
            content.classList.remove('active');
            if (content.id === tabId) {
                content.classList.add('active');
                // Refresh charts when tab becomes active
                if (processedData && (tabId === 'visual-analysis' || tabId === 'forecasting')) {
                    resizeCharts();
                }
            }
        });
    });
});

// Home button
homeBtn.addEventListener('click', () => {
    // Reset to initial state
    fileInput.value = '';
    fileNameDisplay.textContent = 'No file selected';
    analyzeBtn.disabled = true;
    resultsSection.classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Window resize handler for charts
window.addEventListener('resize', debounce(() => {
    if (processedData) {
        resizeCharts();
    }
}, 250));

// ====== Core Functions ======

// Initialize application
function initializeApp() {
    // Add additional initialization if needed
    console.log('Supply Chain Analytics Tool initialized');
}

// Parse uploaded CSV file
function parseCSV(file) {
    Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: function(results) {
            if (results.data && results.data.length > 0) {
                parsedData = validateAndCleanData(results.data);
                if (parsedData) {
                    processData(parsedData);
                    displayResults();
                    resultsSection.classList.remove('hidden');
                    // Scroll to results
                    resultsSection.scrollIntoView({ behavior: 'smooth' });
                }
            } else {
                showError('No valid data found in the CSV file');
            }
        },
        error: function(error) {
            showError('Error parsing CSV: ' + error.message);
        }
    });
}

// Validate and clean uploaded data
function validateAndCleanData(data) {
    // Check if data has the required columns
    const requiredColumns = [
        'Order_ID', 'Supplier', 'Order_Date', 'Expected_Delivery_Date', 
        'Actual_Delivery_Date', 'Product_Category', 'Transportation_Mode', 
        'Supplier_Location', 'Disruption_Type', 'Customer_Demand', 'Order_Quantity'
    ];
    
    const missingColumns = requiredColumns.filter(col => 
        !data[0].hasOwnProperty(col)
    );
    
    if (missingColumns.length > 0) {
        showError(`Missing required columns: ${missingColumns.join(', ')}`);
        return null;
    }
    
    // Clean and transform data
    return data.map(row => {
        // Convert date strings to Date objects
        const orderDate = new Date(row.Order_Date);
        const expectedDate = new Date(row.Expected_Delivery_Date);
        const actualDate = new Date(row.Actual_Delivery_Date);
        
        // Skip invalid dates
        if (isNaN(orderDate) || isNaN(expectedDate) || isNaN(actualDate)) {
            return null;
        }
        
        // Calculate lead time and delay
        const leadTime = Math.round((actualDate - orderDate) / (1000 * 60 * 60 * 24)); // in days
        const expectedLeadTime = Math.round((expectedDate - orderDate) / (1000 * 60 * 60 * 24)); // in days
        const delay = Math.round((actualDate - expectedDate) / (1000 * 60 * 60 * 24)); // in days
        
        return {
            ...row,
            Order_Date: orderDate,
            Expected_Delivery_Date: expectedDate,
            Actual_Delivery_Date: actualDate,
            Month: orderDate.getMonth() + 1, // 1-12
            Year: orderDate.getFullYear(),
            Lead_Time: leadTime > 0 ? leadTime : 0,
            Expected_Lead_Time: expectedLeadTime > 0 ? expectedLeadTime : 0,
            Delay: delay
        };
    }).filter(row => row !== null); // Remove invalid rows
}

// Process the validated data
function processData(data) {
    processedData = {
        // === Key Metrics Analysis ===
        
        // 1. Supplier with highest average lead time
        supplierLeadTimes: calculateAverageByGroup(data, 'Supplier', 'Lead_Time'),
        
        // 2. Transportation mode with lowest average lead time
        transportModeLeadTimes: calculateAverageByGroup(data, 'Transportation_Mode', 'Lead_Time'),
        
        // 3. Month with highest average delays
        monthlyDelays: calculateAverageByGroup(data, 'Month', 'Delay'),
        
        // 4. Disruption type with longest average delay
        disruptionDelays: calculateAverageByGroup(data, 'Disruption_Type', 'Delay'),
        
        // 5. Product category with shortest lead time
        categoryLeadTimes: calculateAverageByGroup(data, 'Product_Category', 'Lead_Time'),
        
        // === Visual Analysis Data ===
        
        // 1. Transportation mode impact on delays
        transportDelayData: prepareTransportDelayData(data),
        
        // 2. Seasonal patterns in lead times
        seasonalPatternData: prepareSeasonalPatternData(data),
        
        // 3. Bullwhip effect analysis (monthly demand vs order quantities)
        bullwhipData: prepareBullwhipData(data),
        
        // 4. Lead time vs order quantity variability
        variabilityData: prepareVariabilityData(data),
        
        // === Forecasting Data ===
        
        // 1. Lead time variability forecast
        leadTimeForecastData: prepareLeadTimeForecast(data),
        
        // 2. Bullwhip effect forecast
        bullwhipForecastData: prepareBullwhipForecast(data)
    };
}

// Display the processed results
function displayResults() {
    // === Display Key Metrics ===
    displayKeyMetrics();
    
    // === Create Visualizations ===
    createCharts();
}

// Display key metrics on the dashboard
function displayKeyMetrics() {
    // 1. Supplier with highest average lead time
    const highestLeadSupplier = getHighestValue(processedData.supplierLeadTimes);
    document.getElementById('highest-lead-supplier').textContent = `${highestLeadSupplier.key} (${highestLeadSupplier.value.toFixed(1)} days)`;
    
    // 2. Transportation mode with lowest average lead time
    const lowestLeadTransport = getLowestValue(processedData.transportModeLeadTimes);
    document.getElementById('lowest-lead-transport').textContent = `${lowestLeadTransport.key} (${lowestLeadTransport.value.toFixed(1)} days)`;
    
    // 3. Month with highest average delays
    const highestDelayMonth = getHighestValue(processedData.monthlyDelays);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    document.getElementById('highest-delay-month').textContent = `${monthNames[highestDelayMonth.key - 1]} (${highestDelayMonth.value.toFixed(1)} days)`;
    
    // 4. Disruption type with longest average delay
    const longestDelayDisruption = getHighestValue(processedData.disruptionDelays);
    document.getElementById('longest-delay-disruption').textContent = `${longestDelayDisruption.key} (${longestDelayDisruption.value.toFixed(1)} days)`;
    
    // 5. Product category with shortest lead time
    const shortestLeadCategory = getLowestValue(processedData.categoryLeadTimes);
    document.getElementById('shortest-lead-category').textContent = `${shortestLeadCategory.key} (${shortestLeadCategory.value.toFixed(1)} days)`;
}

// Create all charts for visualization
function createCharts() {
    // Destroy existing charts if any
    Object.values(charts).forEach(chart => {
        if (chart) chart.destroy();
    });
    
    charts = {};
    
    // === Visual Analysis Charts ===
    
    // 1. Transportation Mode Impact on Delays
    const transportCtx = document.getElementById('transport-delay-chart').getContext('2d');
    charts.transportDelay = createBarChart(
        transportCtx, 
        processedData.transportDelayData,
        'Transportation Modes',
        'Average Delay (days)'
    );
    
    // 2. Seasonal Patterns in Lead Times
    const seasonalCtx = document.getElementById('seasonal-leadtime-chart').getContext('2d');
    charts.seasonalPattern = createLineChart(
        seasonalCtx, 
        processedData.seasonalPatternData,
        'Month',
        'Average Lead Time (days)'
    );
    
    // 3. Bullwhip Effect Analysis
    const bullwhipCtx = document.getElementById('bullwhip-chart').getContext('2d');
    charts.bullwhip = createMultiLineChart(
        bullwhipCtx, 
        processedData.bullwhipData,
        'Month',
        'Quantity'
    );
    
    // 4. Lead Time vs Order Quantity Variability
    const variabilityCtx = document.getElementById('variability-correlation-chart').getContext('2d');
    charts.variability = createScatterChart(
        variabilityCtx, 
        processedData.variabilityData,
        'Order Quantity Variability (%)',
        'Lead Time Variability (%)'
    );
    
    // === Forecasting Charts ===
    
    // 1. Lead Time Variability Forecast
    const leadtimeForecastCtx = document.getElementById('leadtime-forecast-chart').getContext('2d');
    charts.leadtimeForecast = createForecastChart(
        leadtimeForecastCtx, 
        processedData.leadTimeForecastData,
        'Month',
        'Lead Time (days)'
    );
    
    // 2. Bullwhip Effect Forecast
    const bullwhipForecastCtx = document.getElementById('bullwhip-forecast-chart').getContext('2d');
    charts.bullwhipForecast = createForecastChart(
        bullwhipForecastCtx, 
        processedData.bullwhipForecastData,
        'Month',
        'Quantity Ratio'
    );
}

// ====== Data Processing Helpers ======

// Calculate average values by group
function calculateAverageByGroup(data, groupKey, valueKey) {
    const groups = {};
    const counts = {};
    
    data.forEach(row => {
        const key = row[groupKey];
        const value = row[valueKey];
        
        if (key && value !== undefined && value !== null) {
            if (!groups[key]) {
                groups[key] = 0;
                counts[key] = 0;
            }
            
            groups[key] += value;
            counts[key]++;
        }
    });
    
    const result = {};
    for (const key in groups) {
        result[key] = groups[key] / counts[key];
    }
    
    return result;
}

// Get the entry with the highest value from an object
function getHighestValue(obj) {
    return Object.entries(obj)
        .map(([key, value]) => ({ key, value }))
        .reduce((max, curr) => (curr.value > max.value ? curr : max), { key: '', value: -Infinity });
}

// Get the entry with the lowest value from an object
function getLowestValue(obj) {
    return Object.entries(obj)
        .map(([key, value]) => ({ key, value }))
        .reduce((min, curr) => (curr.value < min.value ? curr : min), { key: '', value: Infinity });
}

// Calculate coefficient of variation (variability)
function calculateVariability(values) {
    if (!values || values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    return mean !== 0 ? (stdDev / mean) * 100 : 0; // Return as a percentage
}

// Group data by time periods
function groupByTimePeriod(data, periodKey) {
    const groups = {};
    
    data.forEach(row => {
        const key = row[periodKey];
        if (key !== undefined && key !== null) {
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(row);
        }
    });
    
    return groups;
}

// ====== Chart Data Preparation Functions ======

// Prepare data for transportation mode impact on delays
function prepareTransportDelayData(data) {
    const transportModes = [...new Set(data.map(row => row.Transportation_Mode))];
    const avgDelays = transportModes.map(mode => {
        const modeDays = data.filter(row => row.Transportation_Mode === mode);
        const avgDelay = modeDays.reduce((sum, row) => sum + row.Delay, 0) / modeDays.length;
        return avgDelay;
    });
    
    return {
        labels: transportModes,
        datasets: [{
            label: 'Average Delay (days)',
            data: avgDelays,
            backgroundColor: 'rgba(67, 97, 238, 0.6)',
            borderColor: 'rgba(67, 97, 238, 1)',
            borderWidth: 1
        }]
    };
}

// Prepare data for seasonal patterns in lead times
function prepareSeasonalPatternData(data) {
    const monthlyData = Array(12).fill(0).map(() => []);
    
    data.forEach(row => {
        const month = row.Month - 1; // 0-11
        if (month >= 0 && month < 12) {
            monthlyData[month].push(row.Lead_Time);
        }
    });
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const avgLeadTimes = monthlyData.map(times => 
        times.length > 0 ? times.reduce((sum, time) => sum + time, 0) / times.length : 0
    );
    
    return {
        labels: monthNames,
        datasets: [{
            label: 'Average Lead Time (days)',
            data: avgLeadTimes,
            fill: false,
            borderColor: 'rgba(114, 9, 183, 1)',
            tension: 0.1,
            pointBackgroundColor: 'rgba(114, 9, 183, 1)',
            pointRadius: 4
        }]
    };
}

// Prepare data for bullwhip effect analysis
function prepareBullwhipData(data) {
    // Group data by month and year
    const monthYearData = {};
    
    data.forEach(row => {
        const year = row.Year;
        const month = row.Month;
        const key = `${year}-${month}`;
        
        if (!monthYearData[key]) {
            monthYearData[key] = {
                label: `${getMonthName(month)} ${year}`,
                demands: [],
                orders: []
            };
        }
        
        monthYearData[key].demands.push(row.Customer_Demand);
        monthYearData[key].orders.push(row.Order_Quantity);
    });
    
    // Calculate average demand and orders for each month-year
    const sortedKeys = Object.keys(monthYearData).sort();
    const labels = sortedKeys.map(key => monthYearData[key].label);
    const avgDemands = sortedKeys.map(key => {
        const demands = monthYearData[key].demands;
        return demands.reduce((sum, val) => sum + val, 0) / demands.length;
    });
    const avgOrders = sortedKeys.map(key => {
        const orders = monthYearData[key].orders;
        return orders.reduce((sum, val) => sum + val, 0) / orders.length;
    });
    
    return {
        labels: labels,
        datasets: [
            {
                label: 'Customer Demand',
                data: avgDemands,
                borderColor: 'rgba(67, 97, 238, 1)',
                backgroundColor: 'rgba(67, 97, 238, 0.1)',
                fill: true,
                tension: 0.1
            },
            {
                label: 'Order Quantity',
                data: avgOrders,
                borderColor: 'rgba(247, 37, 133, 1)',
                backgroundColor: 'rgba(247, 37, 133, 0.1)',
                fill: true,
                tension: 0.1
            }
        ]
    };
}

// Prepare data for variability correlation
function prepareVariabilityData(data) {
    // Group data by supplier and month
    const supplierMonthData = {};
    
    data.forEach(row => {
        const supplier = row.Supplier;
        const month = row.Month;
        const year = row.Year;
        const key = `${supplier}-${year}-${month}`;
        
        if (!supplierMonthData[key]) {
            supplierMonthData[key] = {
                leadTimes: [],
                orderQuantities: []
            };
        }
        
        supplierMonthData[key].leadTimes.push(row.Lead_Time);
        supplierMonthData[key].orderQuantities.push(row.Order_Quantity);
    });
    
    // Calculate variability for each group
    const variabilityData = Object.values(supplierMonthData).map(group => {
        const leadTimeVar = calculateVariability(group.leadTimes);
        const orderQuantityVar = calculateVariability(group.orderQuantities);
        
        return {
            x: orderQuantityVar,
            y: leadTimeVar
        };
    }).filter(point => !isNaN(point.x) && !isNaN(point.y));
    
    return {
        datasets: [{
            label: 'Lead Time vs Order Quantity Variability',
            data: variabilityData,
            backgroundColor: 'rgba(114, 9, 183, 0.6)',
            borderColor: 'rgba(114, 9, 183, 1)',
            pointRadius: 6,
            pointHoverRadius: 8
        }]
    };
}

// Prepare data for lead time forecast
function prepareLeadTimeForecast(data) {
    // Group data by month and year
    const monthlyData = {};
    
    data.forEach(row => {
        const year = row.Year;
        const month = row.Month;
        const key = `${year}-${month}`;
        
        if (!monthlyData[key]) {
            monthlyData[key] = {
                label: `${getMonthName(month)} ${year}`,
                leadTimes: []
            };
        }
        
        monthlyData[key].leadTimes.push(row.Lead_Time);
    });
    
    // Calculate average lead time for each month-year
    const sortedKeys = Object.keys(monthlyData).sort();
    const labels = sortedKeys.map(key => monthlyData[key].label);
    const avgLeadTimes = sortedKeys.map(key => {
        const leadTimes = monthlyData[key].leadTimes;
        return leadTimes.reduce((sum, val) => sum + val, 0) / leadTimes.length;
    });
    
    // Generate forecast for next 3 months using simple moving average
    const lastThreeAvg = avgLeadTimes.slice(-3).reduce((sum, val) => sum + val, 0) / 3;
    const trend = (avgLeadTimes[avgLeadTimes.length - 1] - avgLeadTimes[avgLeadTimes.length - 3]) / 3;
    
    const forecastValues = [];
    for (let i = 1; i <= 3; i++) {
        forecastValues.push(lastThreeAvg + trend * i);
    }
    
    // Add forecast labels
    const lastLabelParts = labels[labels.length - 1].split(' ');
    let forecastYear = parseInt(lastLabelParts[1]);
    let forecastMonth = getMonthNumber(lastLabelParts[0]) + 1;
    
    const forecastLabels = [];
    for (let i = 0; i < 3; i++) {
        if (forecastMonth > 12) {
            forecastMonth = 1;
            forecastYear++;
        }
        forecastLabels.push(`${getMonthName(forecastMonth)} ${forecastYear}`);
        forecastMonth++;
    }
    
    return {
        labels: [...labels, ...forecastLabels],
        datasets: [
            {
                label: 'Historical Lead Time',
                data: [...avgLeadTimes, null, null, null],
                borderColor: 'rgba(67, 97, 238, 1)',
                backgroundColor: 'rgba(67, 97, 238, 0.1)',
                fill: true,
                tension: 0.1
            },
            {
                label: 'Forecasted Lead Time',
                data: [...Array(avgLeadTimes.length).fill(null), ...forecastValues],
                borderColor: 'rgba(247, 37, 133, 1)',
                backgroundColor: 'rgba(247, 37, 133, 0.1)',
                borderDash: [5, 5],
                fill: true,
                tension: 0
            }
        ]
    };
}

// Prepare data for bullwhip effect forecast
function prepareBullwhipForecast(data) {
    // Group data by month and year
    const monthlyData = {};
    
    data.forEach(row => {
        const year = row.Year;
        const month = row.Month;
        const key = `${year}-${month}`;
        
        if (!monthlyData[key]) {
            monthlyData[key] = {
                label: `${getMonthName(month)} ${year}`,
                demands: [],
                orders: []
            };
        }
        
        monthlyData[key].demands.push(row.Customer_Demand);
        monthlyData[key].orders.push(row.Order_Quantity);
    });
    
    // Calculate bullwhip ratio for each month-year
    const sortedKeys = Object.keys(monthlyData).sort();
    const labels = sortedKeys.map(key => monthlyData[key].label);
    
    const bullwhipRatios = sortedKeys.map(key => {
        const demands = monthlyData[key].demands;
        const orders = monthlyData[key].orders;
        
        const demandVar = calculateVariability(demands);
        const orderVar = calculateVariability(orders);
        
        return demandVar > 0 ? orderVar / demandVar : 1; // Bullwhip ratio
    });
    
    // Generate forecast for next 3 months using simple moving average
    const lastThreeAvg = bullwhipRatios.slice(-3).reduce((sum, val) => sum + val, 0) / 3;
    const trend = (bullwhipRatios[bullwhipRatios.length - 1] - bullwhipRatios[bullwhipRatios.length - 3]) / 3;
    
    const forecastValues = [];
    for (let i = 1; i <= 3; i++) {
        forecastValues.push(Math.max(1, lastThreeAvg + trend * i));
    }
    
    // Add forecast labels
    const lastLabelParts = labels[labels.length - 1].split(' ');
    let forecastYear = parseInt(lastLabelParts[1]);
    let forecastMonth = getMonthNumber(lastLabelParts[0]) + 1;
    
    const forecastLabels = [];
    for (let i = 0; i < 3; i++) {
        if (forecastMonth > 12) {
            forecastMonth = 1;
            forecastYear++;
        }
        forecastLabels.push(`${getMonthName(forecastMonth)} ${forecastYear}`);
        forecastMonth++;
    }
    
    return {
        labels: [...labels, ...forecastLabels],
        datasets: [
            {
                label: 'Historical Bullwhip Ratio',
                data: [...bullwhipRatios, null, null, null],
                borderColor: 'rgba(67, 97, 238, 1)',
                backgroundColor: 'rgba(67, 97, 238, 0.1)',
                fill: true,
                tension: 0.1
            },
            {
                label: 'Forecasted Bullwhip Ratio',
                data: [...Array(bullwhipRatios.length).fill(null), ...forecastValues],
                borderColor: 'rgba(247, 37, 133, 1)',
                backgroundColor: 'rgba(247, 37, 133, 0.1)',
                borderDash: [5, 5],
                fill: true,
                tension: 0
            }
        ]
    };
}

// ====== Chart Creation Functions ======

// Create a bar chart
function createBarChart(ctx, data, xLabel, yLabel) {
    return new Chart(ctx, {
        type: 'bar',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(26, 26, 46, 0.8)',
                    padding: 10,
                    titleFont: {
                        size: 14
                    },
                    bodyFont: {
                        size: 13
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: xLabel,
                        font: {
                            size: 14
                        }
                    },
                    ticks: {
                        font: {
                            size: 12
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: yLabel,
                        font: {
                            size: 14
                        }
                    },
                    ticks: {
                        font: {
                            size: 12
                        }
                    }
                }
            }
        }
    });
}

// Create a line chart
function createLineChart(ctx, data, xLabel, yLabel) {
    return new Chart(ctx, {
        type: 'line',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(26, 26, 46, 0.8)',
                    padding: 10,
                    titleFont: {
                        size: 14
                    },
                    bodyFont: {
                        size: 13
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: xLabel,
                        font: {
                            size: 14
                        }
                    },
                    ticks: {
                        font: {
                            size: 12
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: yLabel,
                        font: {
                            size: 14
                        }
                    },
                    ticks: {
                        font: {
                            size: 12
                        }
                    }
                }
            }
        }
    });
}

// Create a multi-line chart
function createMultiLineChart(ctx, data, xLabel, yLabel) {
    return new Chart(ctx, {
        type: 'line',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: {
                            size: 12
                        },
                        boxWidth: 12
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(26, 26, 46, 0.8)',
                    padding: 10,
                    titleFont: {
                        size: 14
                    },
                    bodyFont: {
                        size: 13
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: xLabel,
                        font: {
                            size: 14
                        }
                    },
                    ticks: {
                        font: {
                            size: 12
                        },
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: yLabel,
                        font: {
                            size: 14
                        }
                    },
                    ticks: {
                        font: {
                            size: 12
                        }
                    }
                }
            }
        }
    });
}

// Create a scatter chart
function createScatterChart(ctx, data, xLabel, yLabel) {
    return new Chart(ctx, {
        type: 'scatter',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(26, 26, 46, 0.8)',
                    padding: 10,
                    callbacks: {
                        label: function(context) {
                            return `Order Quantity Var: ${context.parsed.x.toFixed(1)}%, Lead Time Var: ${context.parsed.y.toFixed(1)}%`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: xLabel,
                        font: {
                            size: 14
                        }
                    },
                    ticks: {
                        font: {
                            size: 12
                        }
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: yLabel,
                        font: {
                            size: 14
                        }
                    },
                    ticks: {
                        font: {
                            size: 12
                        }
                    }
                }
            }
        }
    });
}

// Create a forecast chart (line chart with forecast)
function createForecastChart(ctx, data, xLabel, yLabel) {
    return new Chart(ctx, {
        type: 'line',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: {
                            size: 12
                        },
                        boxWidth: 12
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(26, 26, 46, 0.8)',
                    padding: 10,
                    titleFont: {
                        size: 14
                    },
                    bodyFont: {
                        size: 13
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: xLabel,
                        font: {
                            size: 14
                        }
                    },
                    ticks: {
                        font: {
                            size: 12
                        },
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: yLabel,
                        font: {
                            size: 14
                        }
                    },
                    ticks: {
                        font: {
                            size: 12
                        }
                    }
                }
            }
        }
    });
}

// ====== Utility Functions ======

// Resize all charts 
function resizeCharts() {
    Object.values(charts).forEach(chart => {
        if (chart) chart.resize();
    });
}

// Show error message
function showError(message) {
    alert(`Error: ${message}`);
    console.error(message);
}

// Get month name from month number (1-12)
function getMonthName(monthNum) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return monthNames[(monthNum - 1) % 12];
}

// Get month number from month name
function getMonthNumber(monthName) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return monthNames.indexOf(monthName) + 1;
}

// Debounce function to limit function calls
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(context, args);
        }, wait);
    };
}
