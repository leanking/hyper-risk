// Global variables
let refreshInterval;
let selectedPosition = '';
let charts = {};
let lastAccountValue = null; // Store the last known account value

// DOM elements
const refreshDataBtn = document.getElementById('refreshData');
const positionSelect = document.getElementById('positionSelect');
const themeToggle = document.getElementById('checkbox');
const themeIcon = document.querySelector('.theme-icon i');

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', function() {
    // Set up event listeners
    refreshDataBtn.addEventListener('click', function(e) {
        e.preventDefault();
        refreshAllData();
    });
    
    positionSelect.addEventListener('change', function() {
        selectedPosition = this.value;
        updatePositionMetricsChart();
    });
    
    // Set up dark mode toggle
    themeToggle.addEventListener('change', function() {
        if (this.checked) {
            document.documentElement.setAttribute('data-theme', 'dark');
            themeIcon.className = 'fas fa-moon';
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            themeIcon.className = 'fas fa-sun';
            localStorage.setItem('theme', 'light');
        }
        
        // Redraw charts to apply theme
        redrawAllCharts();
    });
    
    // Check for saved theme preference or use default (dark)
    const currentTheme = localStorage.getItem('theme') || 'dark';
    if (currentTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeToggle.checked = true;
        themeIcon.className = 'fas fa-moon';
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        themeToggle.checked = false;
        themeIcon.className = 'fas fa-sun';
    }
    
    // Initial data load
    refreshAllData();
    
    // Load account value immediately
    loadMetricHistory('account_value', updateAccountValue);
    
    // Set up auto-refresh (every 60 seconds)
    refreshInterval = setInterval(refreshAllData, 60000);
});

// Redraw all charts to apply theme changes
function redrawAllCharts() {
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    
    // Common layout updates for dark mode
    const layoutUpdates = {
        xaxis: {
            color: isDarkMode ? '#e9ecef' : '#212529',
            linecolor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
        },
        yaxis: {
            gridcolor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            color: isDarkMode ? '#e9ecef' : '#212529',
            linecolor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
        },
        legend: {
            font: {
                color: isDarkMode ? '#e9ecef' : '#212529'
            }
        },
        plot_bgcolor: 'rgba(0,0,0,0)',
        paper_bgcolor: 'rgba(0,0,0,0)'
    };
    
    if (charts.pnl) {
        Plotly.relayout('pnlChart', layoutUpdates);
    }
    
    if (charts.riskMetrics) {
        Plotly.relayout('riskMetricsChart', layoutUpdates);
    }
    
    if (charts.positionMetrics) {
        const positionLayoutUpdates = {
            ...layoutUpdates,
            'yaxis2.color': isDarkMode ? '#e9ecef' : '#212529',
            'yaxis3.color': isDarkMode ? '#e9ecef' : '#212529'
        };
        Plotly.relayout('positionMetricsChart', positionLayoutUpdates);
    }
    
    // Force refresh data to ensure everything is properly styled
    refreshAllData();
}

// Refresh all dashboard data
async function refreshAllData() {
    // Show loading indicator
    refreshDataBtn.innerHTML = '<i class="fas fa-sync-alt fa-spin me-1"></i> Refreshing...';
    
    try {
        // Load data in parallel
        await Promise.all([
            loadRiskSummary(),
            loadRiskAnalysis(),
            loadPositions(),
            loadMetricHistory('total_unrealized_pnl', updatePnlChart),
            loadMetricHistory('portfolio_heat', updateRiskMetricsChart, 'Portfolio Heat'),
            loadMetricHistory('margin_utilization', updateRiskMetricsChart, 'Margin Utilization'),
            loadMetricHistory('account_value', updateAccountValue)
        ]);
        
        // Update position-specific chart if a position is selected
        if (selectedPosition) {
            updatePositionMetricsChart();
        }
    } catch (error) {
        console.error('Error refreshing data:', error);
        showError('Failed to refresh data. Please try again.');
    } finally {
        // Reset loading indicator
        refreshDataBtn.innerHTML = '<i class="fas fa-sync-alt me-1"></i> Refresh Data';
    }
}

// Load risk summary data
async function loadRiskSummary() {
    try {
        const response = await fetch('/api/risk/summary');
        const data = await response.json();
        
        // Update summary cards
        updateSummaryCards(data);
    } catch (error) {
        console.error('Error loading risk summary:', error);
        throw error;
    }
}

// Load risk analysis data
async function loadRiskAnalysis() {
    try {
        const response = await fetch('/api/risk/analysis');
        const data = await response.json();
        
        // Update positions table
        updatePositionsTable(data.positions, data.position_metrics);
        
        // Update warnings
        updateWarnings(data.warnings);
    } catch (error) {
        console.error('Error loading risk analysis:', error);
        throw error;
    }
}

// Load positions list
async function loadPositions() {
    try {
        const response = await fetch('/api/positions');
        const data = await response.json();
        
        // Update position select dropdown
        updatePositionSelect(data.positions);
    } catch (error) {
        console.error('Error loading positions:', error);
        throw error;
    }
}

// Load metric history data
async function loadMetricHistory(metricName, updateChartFunction, label = null) {
    try {
        const response = await fetch(`/api/metrics/${metricName}`);
        const data = await response.json();
        
        // Update the chart
        updateChartFunction(data, label);
    } catch (error) {
        console.error(`Error loading ${metricName} history:`, error);
        throw error;
    }
}

// Load position-specific metric history
async function loadPositionMetricHistory(coin, metricName) {
    try {
        const response = await fetch(`/api/positions/${coin}/${metricName}`);
        return await response.json();
    } catch (error) {
        console.error(`Error loading ${coin} ${metricName} history:`, error);
        throw error;
    }
}

// Update summary cards
function updateSummaryCards(data) {
    // Only update what's provided in the data object
    
    // Portfolio Heat
    if (data.portfolio_heat !== undefined) {
        const portfolioHeat = document.getElementById('portfolioHeat');
        const portfolioHeatBar = document.getElementById('portfolioHeatBar');
        
        portfolioHeat.textContent = data.portfolio_heat.toFixed(1);
        portfolioHeatBar.style.width = `${data.portfolio_heat}%`;
        
        // Set color based on risk level
        if (data.portfolio_heat < 30) {
            portfolioHeatBar.className = 'progress-bar progress-bar-low';
            portfolioHeat.className = 'display-4 me-3 risk-low';
        } else if (data.portfolio_heat < 60) {
            portfolioHeatBar.className = 'progress-bar progress-bar-medium';
            portfolioHeat.className = 'display-4 me-3 risk-medium';
        } else if (data.portfolio_heat < 80) {
            portfolioHeatBar.className = 'progress-bar progress-bar-high';
            portfolioHeat.className = 'display-4 me-3 risk-high';
        } else {
            portfolioHeatBar.className = 'progress-bar progress-bar-critical';
            portfolioHeat.className = 'display-4 me-3 risk-critical';
        }
    }
    
    // Margin Utilization
    if (data.margin_utilization !== undefined) {
        const marginUtilization = document.getElementById('marginUtilization');
        const marginUtilizationBar = document.getElementById('marginUtilizationBar');
        
        marginUtilization.textContent = data.margin_utilization.toFixed(1) + '%';
        marginUtilizationBar.style.width = `${data.margin_utilization}%`;
        
        // Set color based on utilization level
        if (data.margin_utilization < 30) {
            marginUtilizationBar.className = 'progress-bar progress-bar-low';
            marginUtilization.className = 'display-4 me-3 risk-low';
        } else if (data.margin_utilization < 60) {
            marginUtilizationBar.className = 'progress-bar progress-bar-medium';
            marginUtilization.className = 'display-4 me-3 risk-medium';
        } else if (data.margin_utilization < 80) {
            marginUtilizationBar.className = 'progress-bar progress-bar-high';
            marginUtilization.className = 'display-4 me-3 risk-high';
        } else {
            marginUtilizationBar.className = 'progress-bar progress-bar-critical';
            marginUtilization.className = 'display-4 me-3 risk-critical';
        }
    }
    
    // Total Account Value
    if (data.account_value !== undefined) {
        const accountValue = document.getElementById('accountValue');
        accountValue.textContent = '$' + formatNumber(data.account_value);
        lastAccountValue = data.account_value;
    } else if (lastAccountValue !== null) {
        // Use the last known account value if the current data doesn't have it
        const accountValue = document.getElementById('accountValue');
        accountValue.textContent = '$' + formatNumber(lastAccountValue);
    }
    
    // Warning Count
    if (data.warning_count !== undefined) {
        const warningCount = document.getElementById('warningCount');
        warningCount.textContent = data.warning_count || '0';
        
        // Set color based on warning count
        if (data.warning_count === 0) {
            warningCount.className = 'display-4 risk-low';
        } else if (data.warning_count < 3) {
            warningCount.className = 'display-4 risk-medium';
        } else if (data.warning_count < 5) {
            warningCount.className = 'display-4 risk-high';
        } else {
            warningCount.className = 'display-4 risk-critical';
        }
    }
}

// Format number to prevent overflow
function formatNumber(value) {
    if (value >= 1000000) {
        return (value / 1000000).toFixed(2) + 'M';
    } else if (value >= 1000) {
        return (value / 1000).toFixed(2) + 'K';
    } else {
        return value.toFixed(2);
    }
}

// Update positions table
function updatePositionsTable(positions, positionMetrics) {
    const tableBody = document.querySelector('#positionsTable tbody');
    
    if (!positions || positions.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="10" class="text-center">No positions found</td></tr>';
        return;
    }
    
    // Clear the table
    tableBody.innerHTML = '';
    
    // Create a map of position metrics by coin
    const metricsMap = {};
    if (positionMetrics) {
        positionMetrics.forEach(metric => {
            metricsMap[metric.position.coin] = metric;
        });
    }
    
    // Sort positions by risk score (highest first)
    positions.sort((a, b) => {
        const aMetrics = metricsMap[a.coin] || {};
        const bMetrics = metricsMap[b.coin] || {};
        return (bMetrics.risk_score || 0) - (aMetrics.risk_score || 0);
    });
    
    // Add each position to the table
    positions.forEach(position => {
        const metrics = metricsMap[position.coin] || {};
        const row = document.createElement('tr');
        
        // Determine row class based on risk score
        if (metrics.risk_score >= 75) {
            row.classList.add('table-danger');
        } else if (metrics.risk_score >= 50) {
            row.classList.add('table-warning');
        } else if (metrics.risk_score >= 25) {
            row.classList.add('table-info');
        } else {
            row.classList.add('table-success');
        }
        
        // Format PnL with color
        const pnlValue = position.unrealized_pnl || 0;
        const pnlFormatted = `$${Math.abs(pnlValue).toFixed(2)}`;
        const pnlClass = pnlValue >= 0 ? 'text-success' : 'text-danger';
        const pnlPrefix = pnlValue >= 0 ? '+' : '-';
        
        // Format ROE with color
        const roeValue = position.return_on_equity || 0;
        const roeFormatted = `${Math.abs(roeValue).toFixed(2)}%`;
        const roeClass = roeValue >= 0 ? 'text-success' : 'text-danger';
        const roePrefix = roeValue >= 0 ? '+' : '-';
        
        // Create the row content
        row.innerHTML = `
            <td>${position.coin}</td>
            <td>${position.size.toFixed(4)}</td>
            <td>$${position.entry_price.toFixed(2)}</td>
            <td>${position.leverage.toFixed(1)}x</td>
            <td>$${position.liquidation_price.toFixed(2)}</td>
            <td class="${pnlClass}">${pnlPrefix}${pnlFormatted}</td>
            <td>$${position.margin_used.toFixed(2)}</td>
            <td>$${position.position_value.toFixed(2)}</td>
            <td class="${roeClass}">${roePrefix}${roeFormatted}</td>
            <td>${metrics.risk_score ? metrics.risk_score.toFixed(1) : 'N/A'}</td>
        `;
        
        tableBody.appendChild(row);
    });
}

// Update warnings display
function updateWarnings(warnings) {
    const warningsContainer = document.getElementById('warningsContainer');
    
    // Clear existing warnings
    warningsContainer.innerHTML = '';
    
    if (warnings.length === 0) {
        warningsContainer.innerHTML = '<p class="text-center text-muted">No active warnings</p>';
        return;
    }
    
    // Sort warnings by severity (critical first)
    warnings.sort((a, b) => {
        const severityOrder = { 'Critical': 3, 'High': 2, 'Medium': 1, 'Low': 0 };
        return severityOrder[b.severity] - severityOrder[a.severity];
    });
    
    // Add warning cards
    warnings.forEach(warning => {
        const card = document.createElement('div');
        card.className = `warning-card ${warning.severity.toLowerCase()}`;
        
        let relatedPositionText = '';
        if (warning.related_position) {
            relatedPositionText = `<span class="fw-bold">${warning.related_position}</span>: `;
        }
        
        card.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <span class="warning-badge warning-${warning.severity.toLowerCase()}">${warning.severity}</span>
                    <span class="fw-bold">${warning.warning_type.replace(/([A-Z])/g, ' $1').trim()}</span>
                </div>
            </div>
            <p class="mb-1 mt-2">${relatedPositionText}${warning.message}</p>
            <p class="mb-0 text-muted small"><i class="fas fa-lightbulb me-1"></i> ${warning.suggested_action}</p>
        `;
        
        warningsContainer.appendChild(card);
    });
}

// Update position select dropdown
function updatePositionSelect(positions) {
    // Clear existing options
    positionSelect.innerHTML = '';
    
    if (positions.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No positions available';
        positionSelect.appendChild(option);
        return;
    }
    
    // Add options for each position
    positions.forEach(coin => {
        const option = document.createElement('option');
        option.value = coin;
        option.textContent = coin;
        positionSelect.appendChild(option);
    });
    
    // Select the first position by default if none is selected
    if (!selectedPosition && positions.length > 0) {
        selectedPosition = positions[0];
        positionSelect.value = selectedPosition;
        updatePositionMetricsChart();
    }
}

// Update PnL chart
function updatePnlChart(data) {
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    
    // Prepare data for the chart
    const timestamps = data.data.map(item => new Date(item.timestamp * 1000));
    const values = data.data.map(item => item.value);
    
    // Format date for display
    const formatDate = (date) => {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };
    
    // Add date to hover template
    const hovertemplate = '%{y:.2f}<br>%{text}<extra></extra>';
    const textLabels = timestamps.map(t => formatDate(t));
    
    const chartData = [{
        x: timestamps,
        y: values,
        type: 'scatter',
        mode: 'lines',
        name: 'Unrealized PnL',
        line: {
            color: '#4CAF50',
            width: 2
        },
        text: textLabels,
        hovertemplate: hovertemplate
    }];
    
    const layout = {
        margin: { t: 10, r: 50, b: 40, l: 50 },
        height: 450,
        xaxis: {
            title: 'Time',
            showgrid: true,
            gridcolor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            color: isDarkMode ? '#e9ecef' : '#212529',
            linecolor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
        },
        yaxis: {
            title: 'PnL (USD)',
            titlefont: { color: '#4CAF50' },
            tickfont: { color: '#4CAF50' },
            showgrid: true,
            gridcolor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            color: isDarkMode ? '#e9ecef' : '#212529',
            linecolor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
        },
        showlegend: false,
        plot_bgcolor: 'rgba(0,0,0,0)',
        paper_bgcolor: 'rgba(0,0,0,0)'
    };
    
    const config = {
        responsive: true,
        displayModeBar: false
    };
    
    if (!charts.pnl) {
        charts.pnl = Plotly.newPlot('pnlChart', chartData, layout, config);
    } else {
        Plotly.react('pnlChart', chartData, layout, config);
    }
}

// Update Account Value chart
function updateAccountValueChart(data) {
    const timestamps = data.data.map(item => new Date(item.timestamp * 1000));
    const values = data.data.map(item => item.value);
    
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    
    const chartData = [{
        x: timestamps,
        y: values,
        type: 'scatter',
        mode: 'lines',
        name: 'Account Value',
        line: {
            color: '#2196F3',
            width: 2
        },
        fill: 'tozeroy',
        fillcolor: 'rgba(33, 150, 243, 0.1)'
    }];
    
    const layout = {
        margin: { t: 10, r: 10, b: 40, l: 60 },
        xaxis: {
            title: 'Time',
            showgrid: false,
            color: isDarkMode ? '#e9ecef' : '#212529',
            linecolor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
        },
        yaxis: {
            title: 'USD',
            tickprefix: '$',
            showgrid: true,
            gridcolor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            color: isDarkMode ? '#e9ecef' : '#212529',
            linecolor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
        },
        showlegend: false,
        plot_bgcolor: 'rgba(0,0,0,0)',
        paper_bgcolor: 'rgba(0,0,0,0)'
    };
    
    const config = {
        responsive: true,
        displayModeBar: false
    };
    
    if (!charts.accountValue) {
        charts.accountValue = Plotly.newPlot('accountValueChart', chartData, layout, config);
    } else {
        Plotly.react('accountValueChart', chartData, layout, config);
    }
}

// Update Risk Metrics chart
function updateRiskMetricsChart(data, label) {
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    
    if (!charts.riskMetrics) {
        // Initialize the chart with the first dataset
        const timestamps = data.data.map(item => new Date(item.timestamp * 1000));
        const values = data.data.map(item => item.value);
        
        const chartData = [{
            x: timestamps,
            y: values,
            type: 'scatter',
            mode: 'lines',
            name: label,
            line: {
                width: 2
            }
        }];
        
        const layout = {
            margin: { t: 10, r: 10, b: 40, l: 60 },
            xaxis: {
                title: 'Time',
                showgrid: false,
                color: isDarkMode ? '#e9ecef' : '#212529',
                linecolor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
            },
            yaxis: {
                title: 'Value',
                showgrid: true,
                gridcolor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                color: isDarkMode ? '#e9ecef' : '#212529',
                linecolor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
            },
            showlegend: true,
            legend: {
                orientation: 'h',
                y: 1.1,
                font: {
                    color: isDarkMode ? '#e9ecef' : '#212529'
                }
            },
            plot_bgcolor: 'rgba(0,0,0,0)',
            paper_bgcolor: 'rgba(0,0,0,0)'
        };
        
        const config = {
            responsive: true,
            displayModeBar: false
        };
        
        charts.riskMetrics = Plotly.newPlot('riskMetricsChart', chartData, layout, config);
    } else {
        // Add or update the dataset
        const timestamps = data.data.map(item => new Date(item.timestamp * 1000));
        const values = data.data.map(item => item.value);
        
        // Check if this trace already exists
        const chartDiv = document.getElementById('riskMetricsChart');
        const existingTraceIndex = chartDiv.data.findIndex(trace => trace.name === label);
        
        if (existingTraceIndex >= 0) {
            // Update existing trace
            Plotly.restyle('riskMetricsChart', {
                x: [timestamps],
                y: [values]
            }, [existingTraceIndex]);
        } else {
            // Add new trace
            const newTrace = {
                x: timestamps,
                y: values,
                type: 'scatter',
                mode: 'lines',
                name: label,
                line: {
                    width: 2
                }
            };
            
            Plotly.addTraces('riskMetricsChart', newTrace);
        }
        
        // Update layout for dark mode
        const layout = {
            xaxis: {
                color: isDarkMode ? '#e9ecef' : '#212529',
                linecolor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
            },
            yaxis: {
                gridcolor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                color: isDarkMode ? '#e9ecef' : '#212529',
                linecolor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
            },
            legend: {
                font: {
                    color: isDarkMode ? '#e9ecef' : '#212529'
                }
            }
        };
        
        Plotly.relayout('riskMetricsChart', layout);
    }
}

// Update Account Value from latest data
function updateAccountValue(data) {
    if (data && data.data && data.data.length > 0) {
        const latestValue = data.data[data.data.length - 1].value;
        const accountValue = document.getElementById('accountValue');
        
        accountValue.textContent = '$' + formatNumber(latestValue);
        lastAccountValue = latestValue;
        
        // Also update the account value in the risk summary data if it exists
        const riskSummaryData = {
            account_value: latestValue
        };
        updateSummaryCards(riskSummaryData);
    }
}

// Update Position Metrics chart
async function updatePositionMetricsChart() {
    if (!selectedPosition) return;
    
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    
    try {
        // Load position metrics in parallel
        const [unrealizedPnlData, riskScoreData, distanceToLiqData] = await Promise.all([
            loadPositionMetricHistory(selectedPosition, 'unrealized_pnl'),
            loadPositionMetricHistory(selectedPosition, 'risk_score'),
            loadPositionMetricHistory(selectedPosition, 'distance_to_liquidation')
        ]);
        
        // Prepare data for the charts
        const timestamps = unrealizedPnlData.data.map(item => new Date(item.timestamp * 1000));
        
        // Format date for display
        const formatDate = (date) => {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        };
        
        // Add date to hover template
        const hovertemplate = '%{y:.2f}<br>%{text}<extra></extra>';
        const textLabels = timestamps.map(t => formatDate(t));
        
        // Create a grid layout for the three charts
        const layout = {
            grid: {
                rows: 3,
                columns: 1,
                pattern: 'independent',
                roworder: 'top to bottom'
            },
            margin: { t: 30, r: 50, b: 10, l: 50 },
            height: 450, // Increased height to accommodate three charts
            showlegend: false,
            plot_bgcolor: 'rgba(0,0,0,0)',
            paper_bgcolor: 'rgba(0,0,0,0)'
        };
        
        // Common axis settings
        const commonAxisSettings = {
            showgrid: true,
            gridcolor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            color: isDarkMode ? '#e9ecef' : '#212529',
            linecolor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
        };
        
        // Add specific settings for each subplot
        layout.xaxis = {
            ...commonAxisSettings,
            showticklabels: false, // Hide x-axis labels for top chart
            domain: [0, 1]
        };
        layout.yaxis = {
            ...commonAxisSettings,
            title: {
                text: 'Unrealized PnL (USD)',
                font: { color: '#4CAF50' }
            },
            tickfont: { color: '#4CAF50' }
        };
        
        layout.xaxis2 = {
            ...commonAxisSettings,
            showticklabels: false, // Hide x-axis labels for middle chart
            domain: [0, 1]
        };
        layout.yaxis2 = {
            ...commonAxisSettings,
            title: {
                text: 'Risk Score',
                font: { color: '#FF5722' }
            },
            tickfont: { color: '#FF5722' }
        };
        
        layout.xaxis3 = {
            ...commonAxisSettings,
            title: {
                text: 'Time',
                font: { size: 12 }
            },
            domain: [0, 1]
        };
        layout.yaxis3 = {
            ...commonAxisSettings,
            title: {
                text: 'Distance to Liquidation (%)',
                font: { color: '#2196F3' }
            },
            tickfont: { color: '#2196F3' }
        };
        
        // Create data for each chart
        const chartData = [
            // Unrealized PnL chart
            {
                x: timestamps,
                y: unrealizedPnlData.data.map(item => item.value),
                type: 'scatter',
                mode: 'lines',
                name: 'Unrealized PnL',
                line: {
                    color: '#4CAF50',
                    width: 2
                },
                text: textLabels,
                hovertemplate: hovertemplate,
                xaxis: 'x',
                yaxis: 'y'
            },
            // Risk Score chart
            {
                x: timestamps,
                y: riskScoreData.data.map(item => item.value),
                type: 'scatter',
                mode: 'lines',
                name: 'Risk Score',
                line: {
                    color: '#FF5722',
                    width: 2
                },
                text: textLabels,
                hovertemplate: hovertemplate,
                xaxis: 'x2',
                yaxis: 'y2'
            },
            // Distance to Liquidation chart
            {
                x: timestamps,
                y: distanceToLiqData.data.map(item => item.value),
                type: 'scatter',
                mode: 'lines',
                name: 'Distance to Liquidation (%)',
                line: {
                    color: '#2196F3',
                    width: 2
                },
                text: textLabels,
                hovertemplate: hovertemplate,
                xaxis: 'x3',
                yaxis: 'y3'
            }
        ];
        
        // Add annotations for chart titles
        layout.annotations = [
            {
                text: 'Unrealized PnL',
                font: {
                    size: 14,
                    color: '#4CAF50'
                },
                showarrow: false,
                x: 0.02,
                y: 1.02,
                xref: 'paper',
                yref: 'paper',
                xanchor: 'left'
            },
            {
                text: 'Risk Score',
                font: {
                    size: 14,
                    color: '#FF5722'
                },
                showarrow: false,
                x: 0.02,
                y: 0.68,
                xref: 'paper',
                yref: 'paper',
                xanchor: 'left'
            },
            {
                text: 'Distance to Liquidation (%)',
                font: {
                    size: 14,
                    color: '#2196F3'
                },
                showarrow: false,
                x: 0.02,
                y: 0.35,
                xref: 'paper',
                yref: 'paper',
                xanchor: 'left'
            }
        ];
        
        const config = {
            responsive: true,
            displayModeBar: false
        };
        
        if (!charts.positionMetrics) {
            charts.positionMetrics = Plotly.newPlot('positionMetricsChart', chartData, layout, config);
        } else {
            Plotly.react('positionMetricsChart', chartData, layout, config);
        }
    } catch (error) {
        console.error('Error updating position metrics chart:', error);
    }
}

// Show error message
function showError(message) {
    // You could implement a toast notification here
    console.error(message);
    alert(message);
} 