// Initialize variables for Chart instances so we can destroy them to prevent overlaps
let chartInstances = {};

document.getElementById('simulator-form').addEventListener('submit', function(e) {
    e.preventDefault();

    // Reset results container display
    document.getElementById('results-container').style.display = 'block';
    
    // Parse inputs
    const seqStr = document.getElementById('request-sequence').value;
    const initialHead = parseInt(document.getElementById('initial-head').value);
    const totalTracks = parseInt(document.getElementById('total-tracks').value);
    const direction = document.getElementById('head-direction').value; // 'high' or 'low'

    // Clean and validate array
    let requests = seqStr.split(',')
        .map(x => x.trim())
        .filter(x => x !== '')
        .map(x => parseInt(x));
        
    if (requests.some(isNaN)) {
        alert("Please enter valid comma-separated numbers for the request sequence.");
        return;
    }

    if (requests.some(req => req < 0 || req >= totalTracks)) {
        alert(`All requests must be between 0 and ${totalTracks - 1}.`);
        return;
    }
    
    if (initialHead < 0 || initialHead >= totalTracks) {
        alert(`Initial head must be between 0 and ${totalTracks - 1}.`);
        return;
    }

    // Prepare Results object
    const results = [
        { name: 'FCFS', ...simulateFCFS([...requests], initialHead) },
        { name: 'SSTF', ...simulateSSTF([...requests], initialHead) },
        { name: 'SCAN', ...simulateSCAN([...requests], initialHead, totalTracks, direction) },
        { name: 'C-SCAN', ...simulateCSCAN([...requests], initialHead, totalTracks, direction) },
        { name: 'LOOK', ...simulateLOOK([...requests], initialHead, direction) },
        { name: 'C-LOOK', ...simulateCLOOK([...requests], initialHead, direction) }
    ];

    renderResults(results);
});

// Calculate Seek Time from sequence
function calculateSeekTime(sequence) {
    let seekTime = 0;
    for (let i = 0; i < sequence.length - 1; i++) {
        seekTime += Math.abs(sequence[i] - sequence[i + 1]);
    }
    return seekTime;
}

// FCFS Algorithm
function simulateFCFS(requests, head) {
    const sequence = [head, ...requests];
    return { sequence, seekTime: calculateSeekTime(sequence) };
}

// SSTF Algorithm
function simulateSSTF(requests, head) {
    let current = head;
    let sequence = [head];
    let unvisited = [...requests];

    while (unvisited.length > 0) {
        let nearestIndex = 0;
        let minDistance = Math.abs(current - unvisited[0]);
        
        for (let i = 1; i < unvisited.length; i++) {
            let distance = Math.abs(current - unvisited[i]);
            if (distance < minDistance) {
                minDistance = distance;
                nearestIndex = i;
            }
        }
        
        current = unvisited[nearestIndex];
        sequence.push(current);
        unvisited.splice(nearestIndex, 1);
    }
    return { sequence, seekTime: calculateSeekTime(sequence) };
}

// SCAN Algorithm
function simulateSCAN(requests, head, totalTracks, direction) {
    let sequence = [head];
    // Separate into left and right of head
    let left = requests.filter(r => r < head).sort((a, b) => a - b);
    let right = requests.filter(r => r >= head).sort((a, b) => a - b);
    
    if (direction === 'high') {
        if(right.length > 0 || left.length > 0) {
            sequence = sequence.concat(right);
            // Boundary
            if (left.length > 0) {
                sequence.push(totalTracks - 1);
                sequence = sequence.concat(left.reverse());
            }
        }
    } else {
        if(left.length > 0 || right.length > 0) {
           sequence = sequence.concat(left.reverse());
           // Boundary
           if (right.length > 0) {
               sequence.push(0);
               sequence = sequence.concat(right);
           }
        }
    }

    // remove consecutive duplicates that might happen at boundary
    sequence = sequence.filter((val, i, array) => i === 0 || val !== array[i-1]);

    return { sequence, seekTime: calculateSeekTime(sequence) };
}

// C-SCAN Algorithm
function simulateCSCAN(requests, head, totalTracks, direction) {
    let sequence = [head];
    let left = requests.filter(r => r < head).sort((a, b) => a - b);
    let right = requests.filter(r => r >= head).sort((a, b) => a - b);

    if (direction === 'high') {
        sequence = sequence.concat(right);
        if (left.length > 0) {
            sequence.push(totalTracks - 1);
            sequence.push(0); // Jump back
            sequence = sequence.concat(left);
        }
    } else {
        sequence = sequence.concat(left.reverse());
        if (right.length > 0) {
            sequence.push(0);
            sequence.push(totalTracks - 1); // Jump high
            sequence = sequence.concat(right.reverse());
        }
    }

    sequence = sequence.filter((val, i, array) => i === 0 || val !== array[i-1]);

    return { sequence, seekTime: calculateSeekTime(sequence) };
}

// LOOK Algorithm
function simulateLOOK(requests, head, direction) {
    let sequence = [head];
    let left = requests.filter(r => r < head).sort((a, b) => a - b);
    let right = requests.filter(r => r >= head).sort((a, b) => a - b);

    if (direction === 'high') {
        sequence = sequence.concat(right);
        sequence = sequence.concat(left.reverse());
    } else {
        sequence = sequence.concat(left.reverse());
        sequence = sequence.concat(right);
    }
    
    sequence = sequence.filter((val, i, array) => i === 0 || val !== array[i-1]);

    return { sequence, seekTime: calculateSeekTime(sequence) };
}

// C-LOOK Algorithm
function simulateCLOOK(requests, head, direction) {
    let sequence = [head];
    let left = requests.filter(r => r < head).sort((a, b) => a - b);
    let right = requests.filter(r => r >= head).sort((a, b) => a - b);

    if (direction === 'high') {
        sequence = sequence.concat(right);
        if (left.length > 0) {
            sequence = sequence.concat(left);
        }
    } else {
        sequence = sequence.concat(left.reverse());
        if (right.length > 0) {
            sequence = sequence.concat(right.reverse());
        }
    }

    sequence = sequence.filter((val, i, array) => i === 0 || val !== array[i-1]);

    return { sequence, seekTime: calculateSeekTime(sequence) };
}

// Render Results DOM & Charts
function renderResults(results) {
    const grid = document.getElementById('results-grid');
    grid.innerHTML = ''; // Clear previous

    // Create cards for each result
    results.forEach((res, index) => {
        const cardId = `algo-${res.name.toLowerCase().replace('-', '')}`;
        const canvasId = `chart-${cardId}`;

        const cardHTML = `
            <div class="algo-card">
                <div class="algo-header">
                    <h3>${res.name}</h3>
                </div>
                <div class="algo-stats">
                    <div class="stat-item">
                        <span class="stat-label">Total Seek Time</span>
                        <span class="stat-value highlight">${res.seekTime} CyL</span>
                    </div>
                </div>
                <div class="sequence-container">
                    <span class="stat-label" style="display:block; margin-bottom: 5px;">Head Movement Sequence:</span>
                    <p>${res.sequence.join(' &rarr; ')}</p>
                </div>
                <div class="chart-container">
                    <canvas id="${canvasId}"></canvas>
                </div>
            </div>
        `;
        grid.insertAdjacentHTML('beforeend', cardHTML);
        
        // Delay chart drawing slightly to ensure canvas is in DOM
        setTimeout(() => {
            drawChart(canvasId, res.sequence, res.name);
        }, 50);
    });
}

function drawChart(canvasId, sequence, labelText) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }

    // Step labels [0, 1, 2, ...]
    const labels = sequence.map((_, i) => 'Step ' + i);

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(56, 189, 248, 0.4)');
    gradient.addColorStop(1, 'rgba(56, 189, 248, 0.0)');

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Track',
                data: sequence,
                borderColor: '#3b82f6',
                backgroundColor: gradient,
                borderWidth: 2,
                pointBackgroundColor: '#8b5cf6',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#8b5cf6',
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: false, // Since it's zigzagging, fill might look weird, but let's keep it purely line
                tension: 0.1 // Slight bend, almost straight line is better for disk sweeps
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#cbd5e1',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1
                }
            },
            scales: {
                y: {
                    title: { display: true, text: 'Track Number', color: '#94a3b8' },
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#94a3b8' },
                    beginAtZero: true
                },
                x: {
                    display: false, // Hide X steps for cleaner look
                    grid: { display: false }
                }
            }
        }
    });
}
