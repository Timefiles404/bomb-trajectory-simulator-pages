document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('simulationCanvas');
    const ctx = canvas.getContext('2d');

    // Control elements
    const altitudeInput = document.getElementById('altitude');
    const initialSpeedInput = document.getElementById('initialSpeed');
    const flightAngleInput = document.getElementById('flightAngle');
    const accelerationTypeSelect = document.getElementById('accelerationType');
    const accelerationInput = document.getElementById('acceleration');
    const dropIntervalTypeSelect = document.getElementById('dropIntervalType');
    const dropIntervalValueInput = document.getElementById('dropIntervalValue');
    const dropIntervalUnit = document.getElementById('dropIntervalUnit');
    const numberOfBombsInput = document.getElementById('numberOfBombs');
    const airResistanceTypeSelect = document.getElementById('airResistanceType');
    const airResistanceValueInput = document.getElementById('airResistanceValue');
    const startButton = document.getElementById('startButton');
    const resetButton = document.getElementById('resetButton');

    // Simulation parameters
    const G = 9.81; // m/s^2
    let scale = 0.5; // pixels per meter, will be adjusted
    let timeStep = 0.05; // simulation time step in seconds
    let animationFrameId;
    let plane, bombs, groundLevel, simulationTime, bombsDropped;

    function setupCanvas() {
        const controlsHeight = document.querySelector('.controls').offsetHeight;
        const availableHeight = window.innerHeight - controlsHeight - 50; // 50px for margins and title (changed from 100)
        const availableWidth = window.innerWidth - 40; // 40px for margins

        const initialAltitude = parseFloat(altitudeInput.value);
        // Estimate max horizontal distance for scaling
        const maxSpeed = 500; // Max possible speed from input
        const maxTime = (2 * initialAltitude / G)**0.5 + (initialAltitude / maxSpeed) * 5; // Rough estimate
        const maxDistance = maxSpeed * maxTime * 1.2; // Add some buffer

        // Determine scale based on available space and estimated trajectory
        const scaleX = availableWidth / maxDistance;
        const scaleY = availableHeight / initialAltitude;
        scale = Math.min(scaleX, scaleY, 0.5); // Cap max scale to 0.5 for visibility
        if (scale <= 0) scale = 0.1; // Ensure scale is positive

        canvas.width = Math.min(availableWidth, maxDistance * scale * 1.1); // Add 10% buffer or use available width
        canvas.height = availableHeight; // Use full available height for the canvas
        groundLevel = canvas.height - 30; // 30px for ground representation
    }

    function initializeSimulation() {
        setupCanvas();
        simulationTime = 0;
        bombsDropped = 0;

        const initialAltitude = parseFloat(altitudeInput.value);
        const initialSpeed = parseFloat(initialSpeedInput.value);
        const flightAngleRad = parseFloat(flightAngleInput.value) * Math.PI / 180;

        plane = {
            x: 0,
            y: groundLevel - initialAltitude * scale, // y is from top, so subtract from groundLevel
            vx: initialSpeed * Math.cos(flightAngleRad),
            vy: -initialSpeed * Math.sin(flightAngleRad), // Negative because canvas y increases downwards
            ax: 0, // Will be set by acceleration type
            ay: 0, // Plane's vertical acceleration (not gravity for plane itself)
            angle: flightAngleRad,
            accelerationType: accelerationTypeSelect.value,
            accelerationValue: parseFloat(accelerationInput.value),
            path: []
        };
        plane.path.push({x: plane.x, y: plane.y});

        bombs = [];
        updateDropIntervalUnit();
    }

    function updateDropIntervalUnit() {
        if (dropIntervalTypeSelect.value === 'time') {
            dropIntervalUnit.textContent = '秒';
        } else {
            dropIntervalUnit.textContent = '米';
        }
    }
    dropIntervalTypeSelect.addEventListener('change', updateDropIntervalUnit);

    function dropBomb() {
        if (bombsDropped >= parseInt(numberOfBombsInput.value)) return;

        const bomb = {
            x: plane.x,
            y: plane.y,
            vx: plane.vx,
            vy: plane.vy,
            path: [],
            landed: false
        };
        bomb.path.push({x: bomb.x, y: bomb.y});
        bombs.push(bomb);
        bombsDropped++;
    }

    function updatePlaneState() {
        const accType = plane.accelerationType;
        const accVal = plane.accelerationValue;

        // Update acceleration based on type
        if (accType === 'constant_acceleration') {
            plane.ax = accVal * Math.cos(plane.angle);
            plane.ay = -accVal * Math.sin(plane.angle); // Negative for canvas y-up
        } else if (accType === 'constant_deceleration') {
            // Deceleration is negative acceleration along the velocity vector
            const currentSpeed = Math.sqrt(plane.vx**2 + plane.vy**2);
            if (currentSpeed > 0) {
                plane.ax = accVal * (plane.vx / currentSpeed); // accVal is negative for deceleration
                plane.ay = accVal * (plane.vy / currentSpeed);
            } else {
                plane.ax = 0;
                plane.ay = 0;
            }
        } else { // constant_velocity or not_implemented
            plane.ax = 0;
            plane.ay = 0;
        }

        // Update velocity
        plane.vx += plane.ax * timeStep;
        plane.vy += plane.ay * timeStep;

        // Update position
        plane.x += plane.vx * timeStep * scale;
        plane.y += plane.vy * timeStep * scale;
        plane.path.push({x: plane.x, y: plane.y});

        // Update flight angle if speed changes significantly (for non-constant velocity)
        if (accType !== 'constant_velocity' && (plane.ax !== 0 || plane.ay !== 0)) {
            plane.angle = Math.atan2(-plane.vy, plane.vx); // -vy because canvas y is inverted
        }

        // Check for bomb drop condition
        const dropIntervalType = dropIntervalTypeSelect.value;
        const dropIntervalValue = parseFloat(dropIntervalValueInput.value);

        if (dropIntervalType === 'time') {
            if (bombs.length === 0 || (simulationTime - bombs[bombs.length - 1].dropTime >= dropIntervalValue)) {
                if (bombsDropped < parseInt(numberOfBombsInput.value)) {
                    const bomb = {
                        x: plane.x,
                        y: plane.y,
                        vx: plane.vx,
                        vy: plane.vy,
                        path: [],
                        landed: false,
                        dropTime: simulationTime
                    };
                    bomb.path.push({x: bomb.x, y: bomb.y});
                    bombs.push(bomb);
                    bombsDropped++;
                }
            }
        } else { // distance
            if (bombs.length === 0) {
                 if (bombsDropped < parseInt(numberOfBombsInput.value)) dropBomb();
            } else {
                const lastBomb = bombs[bombs.length - 1];
                const distSinceLastBomb = Math.sqrt((plane.x - lastBomb.x)**2 + (plane.y - lastBomb.y)**2) / scale;
                if (distSinceLastBomb >= dropIntervalValue) {
                    if (bombsDropped < parseInt(numberOfBombsInput.value)) dropBomb();
                }
            }
        }
    }

    function updateBombState(bomb) {
        if (bomb.landed) return;

        let ax_bomb = 0;
        let ay_bomb = G; // Gravity acts downwards

        const resistanceType = airResistanceTypeSelect.value;
        const k = parseFloat(airResistanceValueInput.value);

        if (resistanceType !== 'none') {
            const v = Math.sqrt(bomb.vx**2 + bomb.vy**2);
            if (v > 0) {
                let dragForceMagnitude = 0;
                if (resistanceType === 'constant') {
                    dragForceMagnitude = k;
                }
                else if (resistanceType === 'proportional_v') {
                    dragForceMagnitude = k * v;
                }
                // Assuming bomb mass is 1 for simplicity in drag calculation, so F_drag = a_drag
                const drag_ax = -dragForceMagnitude * (bomb.vx / v);
                const drag_ay = -dragForceMagnitude * (bomb.vy / v);
                ax_bomb += drag_ax;
                ay_bomb += drag_ay; // This ay is for physics, canvas vy is inverted
            }
        }

        bomb.vx += ax_bomb * timeStep;
        bomb.vy += ay_bomb * timeStep; // vy is positive downwards in physics coords
        bomb.x += bomb.vx * timeStep * scale;
        bomb.y += bomb.vy * timeStep * scale; // vy is positive downwards, so add to y
        bomb.path.push({x: bomb.x, y: bomb.y});

        if (bomb.y >= groundLevel) {
            bomb.y = groundLevel;
            bomb.landed = true;
        }
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw ground
        ctx.fillStyle = 'green';
        ctx.fillRect(0, groundLevel, canvas.width, canvas.height - groundLevel);

        // Draw plane path
        ctx.strokeStyle = 'rgba(0, 0, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        if(plane.path.length > 0) ctx.moveTo(plane.path[0].x, plane.path[0].y);
        for (let i = 1; i < plane.path.length; i++) {
            ctx.lineTo(plane.path[i].x, plane.path[i].y);
        }
        ctx.stroke();

        // Draw plane (simple triangle for now)
        ctx.save();
        ctx.translate(plane.x, plane.y);
        ctx.rotate(plane.angle);
        ctx.fillStyle = 'blue';
        ctx.beginPath();
        ctx.moveTo(15 * scale, 0);
        ctx.lineTo(-10 * scale, -5 * scale);
        ctx.lineTo(-10 * scale, 5 * scale);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Draw bombs and their paths
        bombs.forEach(bomb => {
            // Draw bomb path
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            if(bomb.path.length > 0) ctx.moveTo(bomb.path[0].x, bomb.path[0].y);
            for (let i = 1; i < bomb.path.length; i++) {
                ctx.lineTo(bomb.path[i].x, bomb.path[i].y);
            }
            ctx.stroke();

            // Draw bomb
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(bomb.x, bomb.y, 3 * scale, 0, Math.PI * 2);
            ctx.fill();
        });

        // Draw scale legend
        ctx.fillStyle = 'black';
        ctx.font = '12px Arial';
        ctx.fillText(`Scale: 1m ≈ ${scale.toFixed(2)}px`, 10, 20);
        ctx.fillText(`Time: ${simulationTime.toFixed(2)}s`, 10, 40);
        ctx.fillText(`Plane: (${(plane.x/scale).toFixed(1)}m, ${((groundLevel - plane.y)/scale).toFixed(1)}m)`, 10, 60);
        if (bombs.length > 0 && !bombs[bombs.length-1].landed) {
            const lastBomb = bombs[bombs.length-1];
            ctx.fillText(`Last Bomb: (${(lastBomb.x/scale).toFixed(1)}m, ${((groundLevel - lastBomb.y)/scale).toFixed(1)}m)`, 10, 80);
        }
    }

    function gameLoop() {
        updatePlaneState();
        bombs.forEach(updateBombState);
        draw();

        simulationTime += timeStep;

        // Stop condition: all bombs landed or plane out of reasonable bounds
        const allBombsLanded = bombs.length > 0 && bombs.length >= parseInt(numberOfBombsInput.value) && bombs.every(b => b.landed);
        const planeOutOfBounds = plane.x > canvas.width + 100 * scale || plane.y < -100 * scale || plane.y > canvas.height + 100 * scale;

        if (allBombsLanded || planeOutOfBounds) {
            console.log("Simulation ended.");
            if (allBombsLanded) console.log("All bombs landed.");
            if (planeOutOfBounds) console.log("Plane out of bounds.");
            cancelAnimationFrame(animationFrameId);
            return;
        }

        animationFrameId = requestAnimationFrame(gameLoop);
    }

    startButton.addEventListener('click', () => {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        initializeSimulation();
        animationFrameId = requestAnimationFrame(gameLoop);
    });

    resetButton.addEventListener('click', () => {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        initializeSimulation(); // Resets variables
        draw(); // Draw initial state
    });

    // Initial setup
    initializeSimulation();
    draw(); // Draw initial state before starting
});
