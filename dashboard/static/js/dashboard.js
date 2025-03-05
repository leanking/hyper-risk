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
    // Initialize tooltips
    initTooltips();
    
    // Initialize charts object
    charts = {};
    
    // Set up event listeners
    refreshDataBtn.addEventListener('click', function(e) {
        e.preventDefault();
        refreshAllData();
    });
    
    // Debug button
    const debugBtn = document.createElement('button');
    debugBtn.className = 'btn btn-sm btn-outline-secondary ms-2';
    debugBtn.innerHTML = '<i class="fas fa-bug"></i> Debug';
    debugBtn.addEventListener('click', function(e) {
        e.preventDefault();
        debugAPI();
    });
    document.querySelector('.navbar-nav').prepend(debugBtn);
    
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
    
    // Add debug button
    addDebugButton();
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
        const response = await fetch('/api/risk_summary');
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
        const response = await fetch('/api/risk_analysis');
        const data = await response.json();
        
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
        updatePositionSelect(data.positions);
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
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`Received data for ${metricName}:`, data);
        
        // Check if data is valid
        if (!data || !data.data || !Array.isArray(data.data)) {
            console.error(`Invalid data format for ${metricName}:`, data);
            throw new Error(`Invalid data format for ${metricName}`);
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
        showError(`Failed to load ${metricName} data: ${error.message}`);
        // Create empty chart to avoid errors
        updateChartFunction({data: []}, label);
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
        // Load position metrics in parallel - removed distance to liquidation
        const [unrealizedPnlData, riskScoreData] = await Promise.all([
            loadPositionMetricHistory(selectedPosition, 'unrealized_pnl'),
            loadPositionMetricHistory(selectedPosition, 'risk_score')
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
        const summaryResponse = await fetch('/api/risk_summary');
        const summaryData = await summaryResponse.json();
        console.log('Risk Summary Response:', summaryData);
        
        // Check risk analysis
        const analysisResponse = await fetch('/api/risk_analysis');
        const analysisData = await analysisResponse.json();
        console.log('Risk Analysis Response:', analysisData);
        
        // Check positions
        const positionsResponse = await fetch('/api/positions');
        const positionsData = await positionsResponse.json();
        console.log('Positions Response:', positionsData);
        
        // Check settings
        const settingsResponse = await fetch('/api/settings');
        const settingsData = await settingsResponse.json();
        console.log('Settings Response:', settingsData);
        
        // Check debug endpoint
        const debugResponse = await fetch('/api/debug/risk_summary');
        const debugData = await debugResponse.json();
        console.log('Debug Response:', debugData);
        
    } catch (error) {
        console.error('Debug API error:', error);
    }
}

// After the document ready function, add this new function
function addDebugButton() {
    // Create debug button
    const debugBtn = document.createElement('button');
    debugBtn.className = 'btn btn-sm btn-outline-secondary ms-2';
    debugBtn.innerHTML = '<i class="fas fa-bug me-1"></i> Debug';
    debugBtn.id = 'debugBtn';
    
    // Add it next to the refresh button
    const refreshBtn = document.getElementById('refreshDataBtn');
    if (refreshBtn && refreshBtn.parentNode) {
        refreshBtn.parentNode.insertBefore(debugBtn, refreshBtn.nextSibling);
    }
    
    // Add event listener
    debugBtn.addEventListener('click', async function() {
        try {
            debugBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Debugging...';
            
            // Create debug modal
            const modal = document.createElement('div');
            modal.className = 'modal fade';
            modal.id = 'debugModal';
            modal.setAttribute('tabindex', '-1');
            modal.setAttribute('aria-labelledby', 'debugModalLabel');
            modal.setAttribute('aria-hidden', 'true');
            
            modal.innerHTML = `
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="debugModalLabel">Debug Information</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="d-flex justify-content-between mb-3">
                                <h6>API Endpoints</h6>
                                <div>
                                    <button id="refreshDebugBtn" class="btn btn-sm btn-outline-primary">
                                        <i class="fas fa-sync-alt me-1"></i> Refresh
                                    </button>
                                </div>
                            </div>
                            <div class="list-group mb-4" id="debugEndpoints">
                                <a href="#" class="list-group-item list-group-item-action" data-endpoint="/api/risk_summary">Risk Summary</a>
                                <a href="#" class="list-group-item list-group-item-action" data-endpoint="/api/debug_risk_summary">Debug Risk Summary</a>
                                <a href="#" class="list-group-item list-group-item-action" data-endpoint="/api/risk_analysis">Risk Analysis</a>
                                <a href="#" class="list-group-item list-group-item-action" data-endpoint="/api/positions">Positions</a>
                                <a href="#" class="list-group-item list-group-item-action" data-endpoint="/api/metrics/total_unrealized_pnl">PnL Metrics</a>
                                <a href="#" class="list-group-item list-group-item-action" data-endpoint="/api/metrics/portfolio_heat">Portfolio Heat Metrics</a>
                                <a href="#" class="list-group-item list-group-item-action" data-endpoint="/api/metrics/margin_utilization">Margin Utilization Metrics</a>
                                <a href="#" class="list-group-item list-group-item-action" data-endpoint="/api/metrics/account_value">Account Value Metrics</a>
                            </div>
                            
                            <h6>Response</h6>
                            <pre id="debugResponse" class="bg-light p-3 rounded" style="max-height: 400px; overflow-y: auto;">Select an endpoint to see the response</pre>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Initialize the modal
            const debugModal = new bootstrap.Modal(document.getElementById('debugModal'));
            debugModal.show();
            
            // Add event listeners to endpoint links
            document.querySelectorAll('#debugEndpoints a').forEach(link => {
                link.addEventListener('click', async function(e) {
                    e.preventDefault();
                    
                    const endpoint = this.getAttribute('data-endpoint');
                    const responseElement = document.getElementById('debugResponse');
                    
                    // Clear previous selection
                    document.querySelectorAll('#debugEndpoints a').forEach(el => {
                        el.classList.remove('active');
                    });
                    
                    // Mark this as active
                    this.classList.add('active');
                    
                    try {
                        responseElement.textContent = 'Loading...';
                        
                        const response = await fetch(endpoint);
                        const data = await response.json();
                        
                        responseElement.textContent = JSON.stringify(data, null, 2);
                    } catch (error) {
                        responseElement.textContent = `Error: ${error.message}`;
                    }
                });
            });
            
            // Add refresh button functionality
            document.getElementById('refreshDebugBtn').addEventListener('click', function() {
                const activeEndpoint = document.querySelector('#debugEndpoints a.active');
                if (activeEndpoint) {
                    activeEndpoint.click();
                }
            });
            
        } catch (error) {
            console.error('Debug error:', error);
            showError('Debug error: ' + error.message);
        } finally {
            debugBtn.innerHTML = '<i class="fas fa-bug me-1"></i> Debug';
        }
    });
}

// Initialize tooltips
function initTooltips() {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
} 