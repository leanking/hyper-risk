// Global variables
let refreshInterval;
let selectedPosition = '';
let charts = {};

// DOM elements
const refreshDataBtn = document.getElementById('refreshData');
const positionSelect = document.getElementById('positionSelect');

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
    
    // Initial data load
    refreshAllData();
    
    // Set up auto-refresh (every 60 seconds)
    refreshInterval = setInterval(refreshAllData, 60000);
});

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
            loadMetricHistory('account_value', updateAccountValueChart),
            loadMetricHistory('portfolio_heat', updateRiskMetricsChart, 'Portfolio Heat'),
            loadMetricHistory('margin_utilization', updateRiskMetricsChart, 'Margin Utilization'),
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
    // Portfolio Heat
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
    
    // Margin Utilization
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
    
    // Highest Risk Position
    const highestRiskPosition = document.getElementById('highestRiskPosition');
    const highestRiskScore = document.getElementById('highestRiskScore');
    
    if (data.highest_risk_position) {
        highestRiskPosition.textContent = data.highest_risk_position.coin;
        highestRiskScore.textContent = `Risk Score: ${data.highest_risk_position.risk_score.toFixed(1)}`;
        
        // Set color based on risk score
        if (data.highest_risk_position.risk_score < 30) {
            highestRiskPosition.className = 'display-6 risk-low';
        } else if (data.highest_risk_position.risk_score < 60) {
            highestRiskPosition.className = 'display-6 risk-medium';
        } else if (data.highest_risk_position.risk_score < 80) {
            highestRiskPosition.className = 'display-6 risk-high';
        } else {
            highestRiskPosition.className = 'display-6 risk-critical';
        }
    } else {
        highestRiskPosition.textContent = 'None';
        highestRiskScore.textContent = 'No positions';
        highestRiskPosition.className = 'display-6';
    }
    
    // Warning Count
    const warningCount = document.getElementById('warningCount');
    
    warningCount.textContent = data.warning_count;
    
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

// Update positions table
function updatePositionsTable(positions, positionMetrics) {
    const tableBody = document.querySelector('#positionsTable tbody');
    
    // Clear existing rows
    tableBody.innerHTML = '';
    
    if (positions.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="10" class="text-center">No positions found</td>';
        tableBody.appendChild(row);
        return;
    }
    
    // Create a map of position metrics by coin for easy lookup
    const metricsMap = {};
    positionMetrics.forEach(metric => {
        metricsMap[metric.position.coin] = metric;
    });
    
    // Add rows for each position
    positions.forEach(position => {
        const metric = metricsMap[position.coin] || {};
        const row = document.createElement('tr');
        
        // Set row color based on risk score
        if (metric.risk_score) {
            if (metric.risk_score < 30) {
                row.className = 'table-success';
            } else if (metric.risk_score < 60) {
                row.className = 'table-warning';
            } else if (metric.risk_score < 80) {
                row.className = 'table-warning';
            } else {
                row.className = 'table-danger';
            }
        }
        
        row.innerHTML = `
            <td>${position.coin}</td>
            <td>${position.size.toFixed(4)}</td>
            <td>${position.entry_price ? '$' + position.entry_price.toFixed(2) : 'N/A'}</td>
            <td>${position.leverage.toFixed(1)}x</td>
            <td>${position.liquidation_price ? '$' + position.liquidation_price.toFixed(2) : 'N/A'}</td>
            <td class="${position.unrealized_pnl >= 0 ? 'text-success' : 'text-danger'}">
                ${position.unrealized_pnl >= 0 ? '+' : ''}$${position.unrealized_pnl.toFixed(2)}
            </td>
            <td>$${position.margin_used.toFixed(2)}</td>
            <td>$${position.position_value.toFixed(2)}</td>
            <td class="${position.return_on_equity >= 0 ? 'text-success' : 'text-danger'}">
                ${position.return_on_equity >= 0 ? '+' : ''}${position.return_on_equity.toFixed(2)}%
            </td>
            <td>${metric.risk_score ? metric.risk_score.toFixed(1) : 'N/A'}</td>
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
    const timestamps = data.data.map(item => new Date(item.timestamp * 1000));
    const values = data.data.map(item => item.value);
    
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
        fill: 'tozeroy',
        fillcolor: 'rgba(76, 175, 80, 0.1)'
    }];
    
    const layout = {
        margin: { t: 10, r: 10, b: 40, l: 60 },
        xaxis: {
            title: 'Time',
            showgrid: false
        },
        yaxis: {
            title: 'USD',
            tickprefix: '$',
            showgrid: true,
            gridcolor: 'rgba(0,0,0,0.05)'
        },
        showlegend: false,
        plot_bgcolor: 'rgba(0,0,0,0)',
        paper_bgcolor: 'rgba(0,0,0,0)'
    };
    
    if (!charts.pnl) {
        charts.pnl = Plotly.newPlot('pnlChart', chartData, layout, { responsive: true });
    } else {
        Plotly.react('pnlChart', chartData, layout);
    }
}

// Update Account Value chart
function updateAccountValueChart(data) {
    const timestamps = data.data.map(item => new Date(item.timestamp * 1000));
    const values = data.data.map(item => item.value);
    
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
            showgrid: false
        },
        yaxis: {
            title: 'USD',
            tickprefix: '$',
            showgrid: true,
            gridcolor: 'rgba(0,0,0,0.05)'
        },
        showlegend: false,
        plot_bgcolor: 'rgba(0,0,0,0)',
        paper_bgcolor: 'rgba(0,0,0,0)'
    };
    
    if (!charts.accountValue) {
        charts.accountValue = Plotly.newPlot('accountValueChart', chartData, layout, { responsive: true });
    } else {
        Plotly.react('accountValueChart', chartData, layout);
    }
}

// Update Risk Metrics chart
function updateRiskMetricsChart(data, label) {
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
                showgrid: false
            },
            yaxis: {
                title: 'Value',
                showgrid: true,
                gridcolor: 'rgba(0,0,0,0.05)'
            },
            showlegend: true,
            legend: {
                orientation: 'h',
                y: 1.1
            },
            plot_bgcolor: 'rgba(0,0,0,0)',
            paper_bgcolor: 'rgba(0,0,0,0)'
        };
        
        charts.riskMetrics = Plotly.newPlot('riskMetricsChart', chartData, layout, { responsive: true });
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
    }
}

// Update Position Metrics chart
async function updatePositionMetricsChart() {
    if (!selectedPosition) return;
    
    try {
        // Load position metrics in parallel
        const [unrealizedPnlData, riskScoreData, distanceToLiqData] = await Promise.all([
            loadPositionMetricHistory(selectedPosition, 'unrealized_pnl'),
            loadPositionMetricHistory(selectedPosition, 'risk_score'),
            loadPositionMetricHistory(selectedPosition, 'distance_to_liquidation')
        ]);
        
        // Prepare data for the chart
        const timestamps = unrealizedPnlData.data.map(item => new Date(item.timestamp * 1000));
        
        const chartData = [
            {
                x: timestamps,
                y: unrealizedPnlData.data.map(item => item.value),
                type: 'scatter',
                mode: 'lines',
                name: 'Unrealized PnL',
                yaxis: 'y',
                line: {
                    color: '#4CAF50',
                    width: 2
                }
            },
            {
                x: timestamps,
                y: riskScoreData.data.map(item => item.value),
                type: 'scatter',
                mode: 'lines',
                name: 'Risk Score',
                yaxis: 'y2',
                line: {
                    color: '#FF5722',
                    width: 2
                }
            },
            {
                x: timestamps,
                y: distanceToLiqData.data.map(item => item.value),
                type: 'scatter',
                mode: 'lines',
                name: 'Distance to Liquidation (%)',
                yaxis: 'y3',
                line: {
                    color: '#2196F3',
                    width: 2
                }
            }
        ];
        
        const layout = {
            margin: { t: 10, r: 60, b: 40, l: 60 },
            xaxis: {
                title: 'Time',
                showgrid: false,
                domain: [0, 0.9]
            },
            yaxis: {
                title: 'PnL (USD)',
                titlefont: { color: '#4CAF50' },
                tickfont: { color: '#4CAF50' },
                showgrid: false
            },
            yaxis2: {
                title: 'Risk Score',
                titlefont: { color: '#FF5722' },
                tickfont: { color: '#FF5722' },
                overlaying: 'y',
                side: 'right',
                position: 0.95,
                showgrid: false
            },
            yaxis3: {
                title: 'Distance to Liq. (%)',
                titlefont: { color: '#2196F3' },
                tickfont: { color: '#2196F3' },
                overlaying: 'y',
                side: 'right',
                showgrid: false
            },
            showlegend: true,
            legend: {
                orientation: 'h',
                y: 1.1
            },
            plot_bgcolor: 'rgba(0,0,0,0)',
            paper_bgcolor: 'rgba(0,0,0,0)'
        };
        
        if (!charts.positionMetrics) {
            charts.positionMetrics = Plotly.newPlot('positionMetricsChart', chartData, layout, { responsive: true });
        } else {
            Plotly.react('positionMetricsChart', chartData, layout);
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