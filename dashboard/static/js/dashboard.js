// Debug mode - set to true to enable console logging
const DEBUG = true;

// Override fetch to log all API requests in debug mode
const originalFetch = window.fetch;
window.fetch = function(url, options) {
    if (DEBUG) {
        console.log(`Fetch request to: ${url}`, options);
    }
    
    return originalFetch(url, options)
        .then(response => {
            if (DEBUG) {
                // Clone the response so we can both log it and return it
                const clone = response.clone();
                clone.text().then(text => {
                    try {
                        const data = JSON.parse(text);
                        console.log(`Response from ${url}:`, data);
                    } catch (e) {
                        console.log(`Response from ${url} (not JSON):`, text.substring(0, 500));
                    }
                });
            }
            return response;
        })
        .catch(error => {
            if (DEBUG) {
                console.error(`Error fetching ${url}:`, error);
            }
            throw error;
        });
};

// Add a startup message
console.log('Dashboard JavaScript loaded. Debug mode:', DEBUG);

// Call debugAPI on page load to diagnose any issues
window.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, running API diagnostics...');
    setTimeout(() => {
        try {
            debugAPI();
        } catch (e) {
            console.error('Error running API diagnostics:', e);
        }
    }, 1000);
});

// Global variables
let refreshInterval;
let selectedPosition = '';
let charts = {};
let lastAccountValue = null; // Store the last known account value
let currentSettings = {}; // Store current settings

// DOM elements
const refreshDataBtn = document.getElementById('refreshData');
const positionSelect = document.getElementById('positionSelect');
const themeToggle = document.getElementById('checkbox');
const themeIcon = document.querySelector('.theme-icon i');
const settingsBtn = document.getElementById('settingsBtn');
const settingsForm = document.getElementById('settingsForm');

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', function() {
    console.log('Document loaded, initializing dashboard...');
    
    // Initialize tooltips
    initTooltips();
    
    // Initialize charts object
    charts = {};
    
    // Set up event listeners
    refreshDataBtn.addEventListener('click', function(e) {
        e.preventDefault();
        refreshAllData();
    });
    
    // Add debug button
    addDebugButton();
    
    positionSelect.addEventListener('change', function() {
        selectedPosition = this.value;
        updatePositionMetricsChart();
    });
    
    // Set up settings button
    document.getElementById('settingsBtn').addEventListener('click', function(e) {
        e.preventDefault();
        loadSettings();
        $('#settingsModal').modal('show');
    });
    
    // Set up settings form submission
    document.getElementById('settingsForm').addEventListener('submit', function(e) {
        e.preventDefault();
        saveSettings();
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
    console.log('Refreshing all dashboard data...');
    
    // Show loading indicator
    refreshDataBtn.innerHTML = '<i class="fas fa-sync-alt fa-spin me-1"></i> Refreshing...';
    
    try {
        // Load data in parallel
        await Promise.all([
            loadRiskSummary().catch(err => {
                console.error('Error loading risk summary:', err);
                return null;
            }),
            loadRiskAnalysis().catch(err => {
                console.error('Error loading risk analysis:', err);
                return null;
            }),
            loadPositions().catch(err => {
                console.error('Error loading positions:', err);
                return null;
            }),
            loadMetricHistory('total_unrealized_pnl', updatePnlChart).catch(err => {
                console.error('Error loading PnL history:', err);
                return null;
            }),
            loadMetricHistory('portfolio_heat', updateRiskMetricsChart, 'Portfolio Heat').catch(err => {
                console.error('Error loading portfolio heat history:', err);
                return null;
            }),
            loadMetricHistory('margin_utilization', updateRiskMetricsChart, 'Margin Utilization').catch(err => {
                console.error('Error loading margin utilization history:', err);
                return null;
            }),
            loadMetricHistory('account_value', updateAccountValue).catch(err => {
                console.error('Error loading account value history:', err);
                return null;
            })
        ]);
        
        // Update position-specific chart if a position is selected
        if (selectedPosition) {
            updatePositionMetricsChart().catch(err => {
                console.error('Error updating position metrics chart:', err);
            });
        }
        
        console.log('All dashboard data refreshed successfully');
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
        console.log('Loading risk summary data...');
        const response = await fetch('/api/risk_summary');
        console.log('Risk summary response status:', response.status);
        const data = await response.json();
        console.log('Risk summary data:', data);
        
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
        console.log('Loading risk analysis data...');
        const response = await fetch('/api/risk_analysis');
        const data = await response.json();
        
        console.log('Risk analysis data:', data);
        
        // Update positions table and warnings
        updatePositionsTable(data.positions, data.position_metrics);
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
        updatePositionSelect(data);
    } catch (error) {
        console.error('Error loading positions:', error);
        throw error;
    }
}

// Load metric history data
async function loadMetricHistory(metricName, updateChartFunction, label = null) {
    try {
        console.log(`Loading metric history for ${metricName}...`);
        const response = await fetch(`/api/metrics/${metricName}`);
        
        if (!response.ok) {
            console.error(`HTTP error loading ${metricName}: ${response.status}`);
            // Create empty chart to avoid errors
            updateChartFunction({data: []}, label);
            return;
        }
        
        const data = await response.json();
        console.log(`Received data for ${metricName}:`, data);
        
        // Check if data is valid
        if (!data || !data.data || !Array.isArray(data.data)) {
            console.error(`Invalid data format for ${metricName}:`, data);
            // Create empty chart to avoid errors
            updateChartFunction({data: []}, label);
            return;
        }
        
        // Check if we have any data points
        if (data.data.length === 0) {
            console.warn(`No data points for ${metricName}`);
            // Create empty chart to avoid errors
            updateChartFunction({data: []}, label);
            return;
        }
        
        // Update the chart
        updateChartFunction(data, label);
    } catch (error) {
        console.error(`Error loading ${metricName} history:`, error);
        // Create empty chart to avoid errors
        updateChartFunction({data: []}, label);
    }
}

// Load position-specific metric history
async function loadPositionMetricHistory(coin, metricName) {
    try {
        console.log(`Loading position metric history for ${coin}/${metricName}...`);
        const response = await fetch(`/api/positions/${coin}/${metricName}`);
        
        if (!response.ok) {
            console.error(`HTTP error loading ${coin}/${metricName}: ${response.status}`);
            // Return empty data structure instead of throwing
            return { coin, metric: metricName, data: [] };
        }
        
        const data = await response.json();
        console.log(`Received data for ${coin}/${metricName}:`, data);
        return data;
    } catch (error) {
        console.error(`Error loading ${coin} ${metricName} history:`, error);
        // Return empty data structure instead of throwing
        return { coin, metric: metricName, data: [] };
    }
}

// Update summary cards
function updateSummaryCards(data) {
    console.log('Updating summary cards with data:', data);
    
    // Only update what's provided in the data object
    
    // Portfolio Heat
    if (data.portfolio_heat !== undefined) {
        console.log('Updating portfolio heat:', data.portfolio_heat);
        const portfolioHeat = document.getElementById('portfolioHeat');
        const portfolioHeatBar = document.getElementById('portfolioHeatBar');
        
        if (!portfolioHeat || !portfolioHeatBar) {
            console.error('Could not find portfolio heat elements');
            return;
        }
        
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
        console.log('Updating margin utilization:', data.margin_utilization);
        const marginUtilization = document.getElementById('marginUtilization');
        const marginUtilizationBar = document.getElementById('marginUtilizationBar');
        
        if (!marginUtilization || !marginUtilizationBar) {
            console.error('Could not find margin utilization elements');
            return;
        }
        
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
    console.log('Updating positions table with:', { positions, positionMetrics });
    
    const tableBody = document.querySelector('#positionsTable tbody');
    
    if (!positions || positions.length === 0) {
        console.log('No positions found');
        tableBody.innerHTML = '<tr><td colspan="9" class="text-center">No positions found</td></tr>';
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
    
    console.log('Position metrics map:', metricsMap);
    
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
            row.className = 'table-danger';
        } else if (metrics.risk_score >= 50) {
            row.className = 'table-warning';
        } else if (metrics.risk_score >= 25) {
            row.className = 'table-info';
        }
        
        // Format the position data
        const size = parseFloat(position.size).toFixed(position.size < 0.1 && position.size > -0.1 ? 5 : 2);
        const leverage = parseFloat(position.leverage).toFixed(1) + 'x';
        const marginType = position.is_cross ? 'cross' : 'isolated';
        const riskScore = metrics.risk_score ? metrics.risk_score.toFixed(1) : '--';
        const liqDistance = metrics.distance_to_liquidation ? metrics.distance_to_liquidation.toFixed(2) + '%' : '--';
        const marginUsed = position.margin_used ? '$' + parseFloat(position.margin_used).toFixed(2) : '--';
        const pnl = position.unrealized_pnl ? '$' + parseFloat(position.unrealized_pnl).toFixed(2) : '--';
        
        // Create the row HTML
        row.innerHTML = `
            <td><strong>${position.coin}</strong></td>
            <td>${size}</td>
            <td>${leverage}</td>
            <td>${marginType}</td>
            <td>${riskScore}</td>
            <td>${liqDistance}</td>
            <td>${marginUsed}</td>
            <td>${pnl}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary position-action" data-action="chart" data-coin="${position.coin}">
                    <i class="fas fa-chart-line"></i>
                </button>
                <button class="btn btn-sm btn-outline-info position-action" data-action="details" data-coin="${position.coin}">
                    <i class="fas fa-info-circle"></i>
                </button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // Add event listeners to the action buttons
    document.querySelectorAll('.position-action').forEach(button => {
        button.addEventListener('click', handlePositionAction);
    });
}

// Update warnings display
function updateWarnings(warnings) {
    const warningsContainer = document.getElementById('warningsContainer');
    const warningCount = document.getElementById('warningCount');
    const warningsCard = document.getElementById('warningsCard');
    
    // Update warning count
    warningCount.textContent = warnings.length;
    
    // Clear existing warnings
    warningsContainer.innerHTML = '';
    
    if (warnings.length === 0) {
        warningsContainer.innerHTML = '<p class="text-center text-muted">No active warnings</p>';
        
        // Update card styling for no warnings
        warningsCard.className = 'card bg-light warnings-card warning-count-0';
        return;
    }
    
    // Sort warnings by severity (critical first)
    warnings.sort((a, b) => {
        const severityOrder = { 'Critical': 3, 'High': 2, 'Medium': 1, 'Low': 0 };
        return severityOrder[b.severity] - severityOrder[a.severity];
    });
    
    // Determine highest severity for card styling
    const highestSeverity = warnings[0].severity.toLowerCase();
    warningsCard.className = `card bg-light warnings-card warning-count-${highestSeverity}`;
    
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
function updatePositionSelect(data) {
    // Clear existing options
    positionSelect.innerHTML = '';
    
    // Check if we have positions data
    const positions = data.positions || [];
    
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
    
    // Check if we have valid data
    if (!data || !data.data || !Array.isArray(data.data) || data.data.length === 0) {
        console.warn("No PnL data available to display");
        // Clear the chart or show empty state
        if (charts.pnl) {
            Plotly.purge('pnlChart');
            charts.pnl = null;
        }
        return;
    }
    
    console.log("Updating PnL chart with data:", data);
    
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
        // Increase margins to prevent clipping
        margin: { t: 20, r: 60, b: 40, l: 60 },
        height: 450,
        xaxis: {
            title: {
                text: 'Time',
                standoff: 10 // Add standoff to prevent title from being cut off
            },
            showgrid: true,
            gridcolor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            color: isDarkMode ? '#e9ecef' : '#212529',
            linecolor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            automargin: true // Add automargin to prevent axis labels from being cut off
        },
        yaxis: {
            title: {
                text: 'PnL (USD)',
                standoff: 10 // Add standoff to prevent title from being cut off
            },
            titlefont: { color: '#4CAF50' },
            tickfont: { color: '#4CAF50' },
            showgrid: true,
            gridcolor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            color: isDarkMode ? '#e9ecef' : '#212529',
            linecolor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            automargin: true // Add automargin to prevent axis labels from being cut off
        },
        showlegend: false,
        plot_bgcolor: 'rgba(0,0,0,0)',
        paper_bgcolor: 'rgba(0,0,0,0)'
    };
    
    const config = {
        responsive: true,
        displayModeBar: false
    };
    
    try {
        if (!charts.pnl) {
            charts.pnl = Plotly.newPlot('pnlChart', chartData, layout, config);
        } else {
            Plotly.react('pnlChart', chartData, layout, config);
        }
        console.log("PnL chart updated successfully");
    } catch (error) {
        console.error("Error updating PnL chart:", error);
        showError("Failed to update PnL chart: " + error.message);
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
    
    // Check if we have valid data
    if (!data || !data.data || !Array.isArray(data.data) || data.data.length === 0) {
        console.warn(`No Risk Metrics data available to display for ${label}`);
        // If this is the first call and no data, clear the chart
        if (!charts.riskMetrics) {
            const emptyChart = [{
                x: [],
                y: [],
                type: 'scatter',
                mode: 'lines',
                name: label || 'No Data'
            }];
            
            const layout = {
                // Increase margins to prevent clipping
                margin: { t: 20, r: 60, b: 40, l: 60 },
                xaxis: {
                    title: {
                        text: 'Time',
                        standoff: 10
                    },
                    showgrid: false,
                    color: isDarkMode ? '#e9ecef' : '#212529',
                    automargin: true
                },
                yaxis: {
                    title: {
                        text: 'Value',
                        standoff: 10
                    },
                    showgrid: true,
                    color: isDarkMode ? '#e9ecef' : '#212529',
                    automargin: true
                },
                showlegend: true,
                plot_bgcolor: 'rgba(0,0,0,0)',
                paper_bgcolor: 'rgba(0,0,0,0)'
            };
            
            const config = {
                responsive: true,
                displayModeBar: false
            };
            
            charts.riskMetrics = Plotly.newPlot('riskMetricsChart', emptyChart, layout, config);
        }
        return;
    }
    
    console.log(`Updating Risk Metrics chart with data for ${label}:`, data);
    
    try {
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
                // Increase margins to prevent clipping
                margin: { t: 20, r: 60, b: 40, l: 60 },
                xaxis: {
                    title: {
                        text: 'Time',
                        standoff: 10
                    },
                    showgrid: false,
                    color: isDarkMode ? '#e9ecef' : '#212529',
                    linecolor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    automargin: true
                },
                yaxis: {
                    title: {
                        text: 'Value',
                        standoff: 10
                    },
                    showgrid: true,
                    gridcolor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    color: isDarkMode ? '#e9ecef' : '#212529',
                    linecolor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    automargin: true
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
            console.log("Risk Metrics chart initialized successfully");
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
            console.log(`Risk Metrics chart updated for ${label}`);
        }
    } catch (error) {
        console.error(`Error updating Risk Metrics chart for ${label}:`, error);
        showError(`Failed to update Risk Metrics chart for ${label}: ${error.message}`);
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
        console.log(`Updating position metrics chart for ${selectedPosition}...`);
        
        // Load position metrics in parallel - removed distance to liquidation
        const [unrealizedPnlData, riskScoreData] = await Promise.all([
            loadPositionMetricHistory(selectedPosition, 'unrealized_pnl'),
            loadPositionMetricHistory(selectedPosition, 'risk_score')
        ]);
        
        console.log('Position metrics data loaded:', { unrealizedPnlData, riskScoreData });
        
        // Check if we have valid data
        if (!unrealizedPnlData.data || !unrealizedPnlData.data.length || 
            !riskScoreData.data || !riskScoreData.data.length) {
            console.warn('No position metrics data available');
            
            // Clear the chart if no data
            Plotly.purge('positionMetricsChart');
            
            // Show a message in the chart area
            const chartDiv = document.getElementById('positionMetricsChart');
            chartDiv.innerHTML = '<div class="text-center p-5"><p class="text-muted">No data available for this position</p></div>';
            return;
        }
        
        // Prepare data for the charts
        const timestamps = unrealizedPnlData.data.map(item => new Date(item.timestamp * 1000));
        
        // Format date for display
        const formatDate = (date) => {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        };
        
        // Add date to hover template
        const hovertemplate = '%{y:.2f}<br>%{text}<extra></extra>';
        const textLabels = timestamps.map(t => formatDate(t));
        
        // Create a grid layout for the two charts
        const layout = {
            grid: {
                rows: 2,
                columns: 1,
                pattern: 'independent',
                roworder: 'top to bottom'
            },
            // Increase margins to prevent clipping
            margin: { t: 40, r: 60, b: 40, l: 60 },
            height: 450,
            showlegend: false,
            plot_bgcolor: 'rgba(0,0,0,0)',
            paper_bgcolor: 'rgba(0,0,0,0)'
        };
        
        // Common axis settings
        const commonAxisSettings = {
            showgrid: true,
            gridcolor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            color: isDarkMode ? '#e9ecef' : '#212529',
            linecolor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            // Add automargin to prevent axis labels from being cut off
            automargin: true
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
                font: { color: '#4CAF50' },
                standoff: 10 // Add standoff to prevent title from being cut off
            },
            tickfont: { color: '#4CAF50' }
        };
        
        layout.xaxis2 = {
            ...commonAxisSettings,
            title: {
                text: 'Time',
                font: { size: 12 },
                standoff: 10 // Add standoff to prevent title from being cut off
            },
            domain: [0, 1]
        };
        layout.yaxis2 = {
            ...commonAxisSettings,
            title: {
                text: 'Risk Score',
                font: { color: '#FF5722' },
                standoff: 10 // Add standoff to prevent title from being cut off
            },
            tickfont: { color: '#FF5722' }
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
                y: 0.48,
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
    console.error(message);
    
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-danger alert-dismissible fade show';
    alertDiv.setAttribute('role', 'alert');
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    document.querySelector('.container-fluid').prepend(alertDiv);
    
    // Auto dismiss after 5 seconds
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

// Load settings from the server
async function loadSettings() {
    console.log('Loading settings...');
    try {
        const response = await fetch('/api/settings');
        console.log('Settings response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const settings = await response.json();
        console.log('Received settings:', settings);
        currentSettings = settings;
        
        // Populate form fields
        document.getElementById('walletAddress').value = settings.wallet_address || '';
        document.getElementById('maxPositionSizeUsd').value = settings.risk_limits.max_position_size_usd || 100000;
        document.getElementById('maxLeverage').value = settings.risk_limits.max_leverage || 50;
        document.getElementById('maxDrawdownPct').value = settings.risk_limits.max_drawdown_pct || 15;
        document.getElementById('maxPositionPct').value = settings.risk_limits.max_position_pct || 20;
        document.getElementById('minDistanceToLiq').value = settings.risk_limits.min_distance_to_liq || 10;
        document.getElementById('maxCorrelation').value = settings.risk_limits.max_correlation || 0.7;
        document.getElementById('maxMarginUtilization').value = settings.risk_limits.max_margin_utilization || 80;
        
    } catch (error) {
        console.error('Error loading settings:', error);
        showError('Failed to load settings. Please try again.');
    }
}

// Save settings to the server
async function saveSettings() {
    console.log('Saving settings...');
    try {
        const settings = {
            wallet_address: document.getElementById('walletAddress').value,
            risk_limits: {
                max_position_size_usd: parseFloat(document.getElementById('maxPositionSizeUsd').value),
                max_leverage: parseFloat(document.getElementById('maxLeverage').value),
                max_drawdown_pct: parseFloat(document.getElementById('maxDrawdownPct').value),
                max_position_pct: parseFloat(document.getElementById('maxPositionPct').value),
                min_distance_to_liq: parseFloat(document.getElementById('minDistanceToLiq').value),
                max_correlation: parseFloat(document.getElementById('maxCorrelation').value),
                max_margin_utilization: parseFloat(document.getElementById('maxMarginUtilization').value)
            }
        };
        
        console.log('Sending settings:', settings);
        
        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(settings)
        });
        
        console.log('Settings response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Close modal and refresh data
        $('#settingsModal').modal('hide');
        showSuccess('Settings saved successfully!');
        refreshAllData();
        
    } catch (error) {
        console.error('Error saving settings:', error);
        showError('Failed to save settings. Please try again.');
    }
}

// Show success message
function showSuccess(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-success alert-dismissible fade show';
    alertDiv.setAttribute('role', 'alert');
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    document.querySelector('.container-fluid').prepend(alertDiv);
    
    // Auto dismiss after 5 seconds
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

// Debug function to check API responses
async function debugAPI() {
    console.log('Debugging API responses...');
    
    try {
        // Check risk summary
        console.log('Fetching /api/risk_summary...');
        const summaryResponse = await fetch('/api/risk_summary');
        console.log('Risk Summary Status:', summaryResponse.status, summaryResponse.statusText);
        console.log('Risk Summary Headers:', Object.fromEntries([...summaryResponse.headers]));
        const summaryData = await summaryResponse.json();
        console.log('Risk Summary Response:', summaryData);
        
        // Check risk analysis
        console.log('Fetching /api/risk_analysis...');
        const analysisResponse = await fetch('/api/risk_analysis');
        console.log('Risk Analysis Status:', analysisResponse.status, analysisResponse.statusText);
        const analysisData = await analysisResponse.json();
        console.log('Risk Analysis Response:', analysisData);
        
        // Check positions
        console.log('Fetching /api/positions...');
        const positionsResponse = await fetch('/api/positions');
        console.log('Positions Status:', positionsResponse.status, positionsResponse.statusText);
        const positionsData = await positionsResponse.json();
        console.log('Positions Response:', positionsData);
        
        // Check settings
        console.log('Fetching /api/settings...');
        const settingsResponse = await fetch('/api/settings');
        console.log('Settings Status:', settingsResponse.status, settingsResponse.statusText);
        const settingsData = await settingsResponse.json();
        console.log('Settings Response:', settingsData);
        
        // Check if we're in development mode
        try {
            console.log('Fetching /api/debug/risk_summary...');
            const debugResponse = await fetch('/api/debug/risk_summary');
            console.log('Debug Status:', debugResponse.status, debugResponse.statusText);
            const debugData = await debugResponse.json();
            console.log('Debug Response:', debugData);
        } catch (debugError) {
            console.log('Debug endpoint not available (expected in production):', debugError);
        }
        
        // Test the main data loading functions
        console.log('Testing loadRiskSummary()...');
        await loadRiskSummary();
        console.log('Testing loadRiskAnalysis()...');
        await loadRiskAnalysis();
        console.log('Testing loadPositions()...');
        await loadPositions();
        
        // Create an alert with the debug information
        alert('Debug information has been logged to the console. Please open the browser console (F12) to view it.');
        
    } catch (error) {
        console.error('Debug API error:', error);
        alert('Error during debugging: ' + error.message + '\nCheck the console for more details.');
    }
}

// Add debug button to the dashboard
function addDebugButton() {
    console.log('Adding debug button...');
    
    // Check if debug button already exists
    if (document.getElementById('debugBtn')) {
        console.log('Debug button already exists, not adding another one');
        return;
    }
    
    // Create debug button
    const debugBtn = document.createElement('button');
    debugBtn.className = 'btn btn-sm btn-outline-secondary ms-2';
    debugBtn.innerHTML = '<i class="fas fa-bug"></i> Debug';
    debugBtn.id = 'debugBtn'; // Add ID for easy reference
    debugBtn.addEventListener('click', function(e) {
        e.preventDefault();
        debugAPI();
    });
    
    // Add to navbar
    const navbar = document.querySelector('.navbar-nav');
    if (navbar) {
        navbar.prepend(debugBtn);
        console.log('Debug button added to navbar');
    } else {
        console.error('Could not find navbar to add debug button');
    }
}

// Initialize tooltips
function initTooltips() {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
}

// Handle position action buttons
function handlePositionAction(e) {
    e.preventDefault();
    const action = e.currentTarget.dataset.action;
    const coin = e.currentTarget.dataset.coin;
    
    if (action === 'chart') {
        // Set the selected position and update the chart
        selectedPosition = coin;
        positionSelect.value = coin;
        updatePositionMetricsChart();
    } else if (action === 'details') {
        // Show position details
        showPositionDetails(coin);
    }
}

// Show position details
function showPositionDetails(coin) {
    // Find the position data
    const positions = document.querySelectorAll('#positionsTable tbody tr');
    let positionData = null;
    
    positions.forEach(row => {
        if (row.querySelector('td:first-child').textContent.trim() === coin) {
            positionData = {
                coin: coin,
                size: row.querySelector('td:nth-child(2)').textContent,
                leverage: row.querySelector('td:nth-child(3)').textContent,
                marginType: row.querySelector('td:nth-child(4)').textContent,
                riskScore: row.querySelector('td:nth-child(5)').textContent,
                liqDistance: row.querySelector('td:nth-child(6)').textContent,
                marginUsed: row.querySelector('td:nth-child(7)').textContent,
                pnl: row.querySelector('td:nth-child(8)').textContent
            };
        }
    });
    
    if (!positionData) {
        showError(`Could not find details for ${coin}`);
        return;
    }
    
    // Create modal content
    const modalTitle = document.querySelector('#positionDetailsModal .modal-title');
    const modalBody = document.querySelector('#positionDetailsModal .modal-body');
    
    modalTitle.textContent = `${coin} Position Details`;
    modalBody.innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <p><strong>Size:</strong> ${positionData.size}</p>
                <p><strong>Leverage:</strong> ${positionData.leverage}</p>
                <p><strong>Margin Type:</strong> ${positionData.marginType}</p>
                <p><strong>Risk Score:</strong> ${positionData.riskScore}</p>
            </div>
            <div class="col-md-6">
                <p><strong>Liquidation Distance:</strong> ${positionData.liqDistance}</p>
                <p><strong>Margin Used:</strong> ${positionData.marginUsed}</p>
                <p><strong>Unrealized PnL:</strong> ${positionData.pnl}</p>
            </div>
        </div>
    `;
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('positionDetailsModal'));
    modal.show();
} 