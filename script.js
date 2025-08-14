window.onload = function() {
    // --- Basic Scene Setup ---
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById('bg-canvas'),
        antialias: true,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    camera.position.z = 50;

    // --- Constants ---
    const worldBounds = 100;
    const eventHorizonRadius = 2;

    // --- Starfield Particle System Setup ---
    const particleCount = 10000;
    const starPositions = new Float32Array(particleCount * 3);
    const particleVelocities = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        starPositions[i3] = (Math.random() - 0.5) * 200; starPositions[i3 + 1] = (Math.random() - 0.5) * 200; starPositions[i3 + 2] = (Math.random() - 0.5) * 200;
        particleVelocities[i3] = (Math.random() - 0.5) * 0.1; particleVelocities[i3 + 1] = (Math.random() - 0.5) * 0.1; particleVelocities[i3 + 2] = (Math.random() - 0.5) * 0.1;
    }
    const particlesGeometry = new THREE.BufferGeometry();
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const particlesMaterial = new THREE.PointsMaterial({ color: 0x8a8aff, size: 0.1, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const particles = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particles);

    // --- Black Hole Setup ---
    const blackHoleGroup = new THREE.Group();
    scene.add(blackHoleGroup);

    // Gravitational Lensing Shader
    const blackHoleShader = {
        uniforms: {
            u_time: { value: 0.0 },
            u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
            u_mouse: { value: new THREE.Vector2(0,0) },
            u_bg_texture: { value: null }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            varying vec2 vUv;
            uniform vec2 u_resolution;
            uniform float u_time;
            uniform sampler2D u_bg_texture; // Background texture

            // This is a simplified lensing effect
            void main() {
                vec2 screenCoord = gl_FragCoord.xy / u_resolution.xy;
                vec2 centeredUv = vUv - 0.5;
                float r = length(centeredUv);

                // Simplified Schwarzschild radius effect
                float schwarzschildRadius = 0.25;

                if (r < schwarzschildRadius) {
                    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); // Black hole center
                    return;
                }

                // Lensing distortion
                vec2 distortion = centeredUv / r;
                float distortionFactor = (schwarzschildRadius / r) * 2.0;
                vec2 distortedCoord = screenCoord - distortion * distortionFactor;

                // Accretion Disk
                float disk = 1.0 - smoothstep(schwarzschildRadius, schwarzschildRadius + 0.3, r);
                float angle = atan(centeredUv.y, centeredUv.x);
                float noise = 0.5 + 0.5 * sin(angle * 20.0 + u_time * 3.0) * cos(angle * 5.0 - u_time);
                vec3 diskColor = mix(vec3(1.0, 0.4, 0.1), vec3(1.0, 0.9, 0.5), noise);

                vec4 bgColor = texture2D(u_bg_texture, distortedCoord);

                gl_FragColor = bgColor + vec4(diskColor * disk, 1.0);
            }
        `
    };

    const blackHoleGeometry = new THREE.SphereGeometry(eventHorizonRadius, 64, 64);
    const blackHoleMaterial = new THREE.ShaderMaterial(blackHoleShader);
    const blackHoleMesh = new THREE.Mesh(blackHoleGeometry, blackHoleMaterial);
    blackHoleGroup.add(blackHoleMesh);

    const diskParticleCount = 2000; const diskPositions = new Float32Array(diskParticleCount * 3); const diskData = [];
    const maxRadius = 10; const minRadius = 3.5; // Increased minRadius to avoid overlapping with shader visuals
    for (let i = 0; i < diskParticleCount; i++) {
        const radius = Math.random() * (maxRadius - minRadius) + minRadius; const angle = Math.random() * Math.PI * 2; const i3 = i * 3;
        diskPositions[i3] = Math.cos(angle) * radius; diskPositions[i3+1] = (Math.random() - 0.5) * 0.5; diskPositions[i3+2] = Math.sin(angle) * radius;
        diskData.push({ angle, radius, speed: (0.5 / radius) * 0.1 + 0.005 });
    }
    const diskGeometry = new THREE.BufferGeometry(); diskGeometry.setAttribute('position', new THREE.BufferAttribute(diskPositions, 3));
    const diskMaterial = new THREE.PointsMaterial({ color: 0xffa500, size: 0.08, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 });
    const accretionDisk = new THREE.Points(diskGeometry, diskMaterial);
    blackHoleGroup.add(accretionDisk);

    // --- Spaceship Setup ---
    const shipCount = 10000; const shipVelocities = [];
    const eventHorizonRadiusSq = eventHorizonRadius * eventHorizonRadius;
    const shipGravityInfluenceRadiusSq = 900; // Ships are affected by gravity if dSq < 900
    const shipRespawnMinDistSq = shipGravityInfluenceRadiusSq + 225; // Respawn ships outside this squared distance (30^2 + 15^2 buffer)
    const fighterGeometry = new THREE.ConeGeometry(0.1, 0.5, 4); const fighterMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const fighters = new THREE.InstancedMesh(fighterGeometry, fighterMaterial, shipCount / 2); scene.add(fighters);
    const battleshipGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.8); const battleshipMaterial = new THREE.MeshBasicMaterial({ color: 0x999999 });
    const battleships = new THREE.InstancedMesh(battleshipGeometry, battleshipMaterial, shipCount / 2); scene.add(battleships);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < shipCount; i++) {
        dummy.position.set( (Math.random() - 0.5) * worldBounds * 2, (Math.random() - 0.5) * worldBounds * 2, (Math.random() - 0.5) * worldBounds * 2 );
        dummy.lookAt(dummy.position.x + (Math.random() - 0.5), dummy.position.y + (Math.random() - 0.5), dummy.position.z + (Math.random() - 0.5)); dummy.updateMatrix();
        const velocity = new THREE.Vector3((Math.random() - 0.5) * 0.01, (Math.random() - 0.5) * 0.01, (Math.random() - 0.5) * 0.01);
        if (i < shipCount / 2) { fighters.setMatrixAt(i, dummy.matrix); velocity.multiplyScalar(2); } else { battleships.setMatrixAt(i - (shipCount / 2), dummy.matrix); }
        shipVelocities.push(velocity);
    }
    fighters.instanceMatrix.needsUpdate = true; battleships.instanceMatrix.needsUpdate = true;

    // --- Black Hole Animation State ---
    const bhInitialPos = new THREE.Vector3(0, 0, 0);
    const bhCornerPos = new THREE.Vector3(30, 15, 0);
    const bhTargetPos = new THREE.Vector3(0, 0, 0);
    const bhInitialRot = new THREE.Euler(0.8, 0, 0);
    const bhCornerRot = new THREE.Euler(0.2, 0, 0);
    const bhTargetRot = new THREE.Euler().copy(bhInitialRot);
    const bhInitialScale = new THREE.Vector3(1, 1, 1);
    const bhCornerScale = new THREE.Vector3(0.5, 0.5, 0.5);
    const bhTargetScale = new THREE.Vector3(1, 1, 1);

    // --- UI Interaction ---
    const menuLinks = document.querySelectorAll('.menu-link');
    const contentPanels = document.querySelectorAll('.content-panel');
    const closeBtns = document.querySelectorAll('.close-btn');

    function openPanel(sectionId) {
        contentPanels.forEach(p => {
            p.classList.add('hidden'); p.classList.remove('visible');
        });
        const panel = document.getElementById(`${sectionId}-section`);
        if (panel) {
            panel.classList.remove('hidden');
            setTimeout(() => panel.classList.add('visible'), 10);
            bhTargetPos.copy(bhCornerPos);
            bhTargetRot.set(bhCornerRot.x, bhCornerRot.y, bhCornerRot.z);
            bhTargetScale.copy(bhCornerScale);
        }
    }

    function closePanels() {
         contentPanels.forEach(p => {
            p.classList.remove('visible');
            setTimeout(() => p.classList.add('hidden'), 500);
        });
        bhTargetPos.copy(bhInitialPos);
        bhTargetRot.set(bhInitialRot.x, bhTargetRot.y, bhInitialRot.z);
        bhTargetScale.copy(bhInitialScale);
    }

    const handleMenuInteraction = (e) => {
        e.preventDefault();
        const sectionId = e.currentTarget.getAttribute('data-section');
        openPanel(sectionId);
    };

    const handleCloseInteraction = (e) => {
        e.preventDefault();
        closePanels();
    }

    menuLinks.forEach(link => {
        link.addEventListener('click', handleMenuInteraction);
        link.addEventListener('touchstart', handleMenuInteraction, { passive: false });
    });

    closeBtns.forEach(btn => {
        btn.addEventListener('click', handleCloseInteraction);
        btn.addEventListener('touchstart', handleCloseInteraction, { passive: false });
    });


    // --- Mouse Interaction ---
    const mouse = new THREE.Vector2(); const interactionPoint = new THREE.Vector3(); let isRepelling = false;
    window.addEventListener('mousemove', (event) => { mouse.x = (event.clientX / window.innerWidth) * 2 - 1; mouse.y = -(event.clientY / window.innerHeight) * 2 + 1; });
    window.addEventListener('mousedown', () => { isRepelling = true; }); window.addEventListener('mouseup', () => { isRepelling = false; });
    function updateMouseFromTouch(touch) { mouse.x = (touch.clientX / window.innerWidth) * 2 - 1; mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1; }
    window.addEventListener('touchstart', (event) => { isRepelling = true; updateMouseFromTouch(event.touches[0]); }, { passive: false });
    window.addEventListener('touchend', (event) => { isRepelling = false; });
    window.addEventListener('touchmove', (event) => { updateMouseFromTouch(event.touches[0]); }, { passive: false });

    // --- Camera Controls ---
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 10;
    controls.maxDistance = 200;
    controls.maxPolarAngle = Math.PI / 2;

    // --- Animation Loop ---
    const clock = new THREE.Clock();
    function animate() {
        requestAnimationFrame(animate);

        controls.update(); // Update camera controls

        // --- Animate Black Hole ---
        blackHoleMaterial.uniforms.u_time.value = clock.getElapsedTime();
        blackHoleGroup.position.lerp(bhTargetPos, 0.05);
        blackHoleGroup.scale.lerp(bhTargetScale, 0.05);
        bhTargetRot.y = blackHoleGroup.rotation.y + 0.001;
        const targetQuat = new THREE.Quaternion().setFromEuler(bhTargetRot);
        blackHoleGroup.quaternion.slerp(targetQuat, 0.05);

        // --- Starfield Physics ---
        const vector = new THREE.Vector3(mouse.x, mouse.y, 0.5); vector.unproject(camera); const dir = vector.sub(camera.position).normalize(); const distance = -camera.position.z / dir.z;
        interactionPoint.copy(camera.position).add(dir.multiplyScalar(distance));
        const posArray = particlesGeometry.attributes.position.array; const velArray = particleVelocities;
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            const particlePosition = new THREE.Vector3(posArray[i3], posArray[i3 + 1], posArray[i3 + 2]);
            const directionToMouse = new THREE.Vector3().subVectors(interactionPoint, particlePosition);
            const distSqMouse = directionToMouse.lengthSq();
            const interactionRadiusSq = 400;
            if (distSqMouse < interactionRadiusSq) { const force = (isRepelling ? -1 : 1) * (1 - Math.sqrt(distSqMouse) / Math.sqrt(interactionRadiusSq)); velArray[i3] += directionToMouse.x * force * 0.1; velArray[i3 + 1] += directionToMouse.y * force * 0.1; }

            // --- Black Hole Gravity on Stars ---
            const directionToBH = new THREE.Vector3().subVectors(blackHoleGroup.position, particlePosition);
            const distSqBH = directionToBH.lengthSq();
            if(distSqBH < 400) {
                const gravity = 10 / distSqBH;
                velArray[i3] += directionToBH.x * gravity;
                velArray[i3+1] += directionToBH.y * gravity;
                velArray[i3+2] += directionToBH.z * gravity;
            }
            if (distSqBH < eventHorizonRadius * eventHorizonRadius) {
                posArray[i3] = (Math.random() - 0.5) * worldBounds * 2;
                posArray[i3+1] = (Math.random() - 0.5) * worldBounds * 2;
                posArray[i3+2] = (Math.random() - 0.5) * worldBounds * 2;
                velArray[i3] = velArray[i3+1] = velArray[i3+2] = 0;
            }

            velArray[i3] *= 0.97; velArray[i3 + 1] *= 0.97; velArray[i3 + 2] *= 0.97;
            posArray[i3] += velArray[i3]; posArray[i3 + 1] += velArray[i3 + 1]; posArray[i3 + 2] += velArray[i3 + 2];
        }
        particlesGeometry.attributes.position.needsUpdate = true;

        // --- Black Hole Accretion Disk Animation ---
        const diskPosArray = diskGeometry.attributes.position.array;
        for (let i = 0; i < diskParticleCount; i++) {
            const data = diskData[i]; data.angle += data.speed; data.radius -= 0.005; if (data.radius < minRadius) { data.radius = maxRadius; }
            const i3 = i * 3; diskPosArray[i3] = Math.cos(data.angle) * data.radius; diskPosArray[i3+2] = Math.sin(data.angle) * data.radius;
        }
        diskGeometry.attributes.position.needsUpdate = true;

        // --- Ship Movement & BH Gravity ---
        const matrix = new THREE.Matrix4();
        const currentShipPosition = new THREE.Vector3(); // Re-use this vector

        for (let i = 0; i < shipCount; i++) {
            const mesh = i < shipCount / 2 ? fighters : battleships;
            const instanceId = i < shipCount / 2 ? i : i - (shipCount / 2);
            mesh.getMatrixAt(instanceId, matrix);
            dummy.matrix.copy(matrix); // Copy current matrix to dummy

            currentShipPosition.setFromMatrixPosition(dummy.matrix); // Get current world position

            const dirToBH = new THREE.Vector3().subVectors(blackHoleGroup.position, currentShipPosition);
            const dSqBH = dirToBH.lengthSq();

            // 1. Apply Gravity
            if (dSqBH < shipGravityInfluenceRadiusSq && dSqBH > 0.001) { // dSqBH > 0.001 to avoid issues if at exact center
                const effectiveDSqBH = Math.max(dSqBH, eventHorizonRadiusSq); // Force no stronger than at event horizon
                const gravityMagnitude = 20 / effectiveDSqBH; // Adjust 20 (the "mass" of BH) if needed

                dirToBH.normalize(); // We only want the direction
                shipVelocities[i].x += dirToBH.x * gravityMagnitude;
                shipVelocities[i].y += dirToBH.y * gravityMagnitude;
                shipVelocities[i].z += dirToBH.z * gravityMagnitude;
            }

            // 2. Apply Velocity Damping
            shipVelocities[i].multiplyScalar(0.985); // Tune damping factor (e.g., 0.98 to 0.995)

            // 3. Update Position based on velocity
            dummy.position.add(shipVelocities[i]); // Add current velocity to dummy's local position
            dummy.updateMatrix(); // Important: update matrix after changing position

            // 4. Check for Consumption by Black Hole (using updated position)
            currentShipPosition.setFromMatrixPosition(dummy.matrix); // Get new position after movement
            const finalDSqBH = currentShipPosition.distanceToSquared(blackHoleGroup.position);

            if (finalDSqBH < eventHorizonRadiusSq) {
                let newPos = new THREE.Vector3();
                let newDSqFromBH;
                let attempts = 0;
                const maxAttempts = 20; // Prevent potential infinite loop for finding respawn spot

                do {
                    // Generate a random position within worldBounds, centered around origin for now
                    const x = (Math.random() - 0.5) * worldBounds * 1.5; // Slightly wider spawn area
                    const y = (Math.random() - 0.5) * worldBounds * 1.5;
                    const z = (Math.random() - 0.5) * worldBounds * 1.5;
                    newPos.set(x, y, z);

                    // Check distance from the black hole's actual current center
                    newDSqFromBH = newPos.distanceToSquared(blackHoleGroup.position);
                    attempts++;
                } while (newDSqFromBH < shipRespawnMinDistSq && attempts < maxAttempts);

                dummy.position.copy(newPos); // Set the new position

                const initialSpeed = 0.05 + Math.random() * 0.05; // Base speed for respawned ships
                if (attempts >= maxAttempts && newDSqFromBH < shipRespawnMinDistSq) {
                    // If still too close after max attempts (unlikely but a safeguard),
                    // give it a nudge directly away from the black hole.
                    const escapeVector = new THREE.Vector3().subVectors(newPos, blackHoleGroup.position).normalize();
                    shipVelocities[i].copy(escapeVector).multiplyScalar(initialSpeed);
                } else {
                    // Otherwise, assign a new random velocity
                    shipVelocities[i].set(
                        (Math.random() - 0.5),
                        (Math.random() - 0.5),
                        (Math.random() - 0.5)
                    ).normalize().multiplyScalar(initialSpeed);
                }
                dummy.updateMatrix(); // Update matrix after position and velocity change
            } else {
                // 5. Wrap ships around the world bounds if not consumed
                // It's better to update dummy.position directly for wrapping and then update matrix
                let wrapped = false;
                if (dummy.position.x > worldBounds) { dummy.position.x = -worldBounds; wrapped = true; }
                else if (dummy.position.x < -worldBounds) { dummy.position.x = worldBounds; wrapped = true; }

                if (dummy.position.y > worldBounds) { dummy.position.y = -worldBounds; wrapped = true; }
                else if (dummy.position.y < -worldBounds) { dummy.position.y = worldBounds; wrapped = true; }

                if (dummy.position.z > worldBounds) { dummy.position.z = -worldBounds; wrapped = true; }
                else if (dummy.position.z < -worldBounds) { dummy.position.z = worldBounds; wrapped = true; }

                if(wrapped) {
                    dummy.updateMatrix(); // Update matrix only if position wrapped
                }
            }
            // Ensure the instanced mesh is updated with the dummy's final matrix for this frame
            mesh.setMatrixAt(instanceId, dummy.matrix);
        }
        fighters.instanceMatrix.needsUpdate = true; // Signal that instance matrices have changed
        battleships.instanceMatrix.needsUpdate = true;

        // --- Camera and Render ---
        // camera.position.x = Math.sin(clock.getElapsedTime() * 0.05) * 5; camera.position.y = Math.cos(clock.getElapsedTime() * 0.05) * 5;
        // camera.lookAt(scene.position);

        // Render to texture for lensing effect
        blackHoleMesh.visible = false;
        renderer.setRenderTarget(renderTarget);
        renderer.render(scene, camera);

        blackHoleMaterial.uniforms.u_bg_texture.value = renderTarget.texture;

        renderer.setRenderTarget(null);
        blackHoleMesh.visible = true;

        renderer.render(scene, camera);
    }

        let renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);

    animate();

    // Handle window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
            renderTarget.setSize(window.innerWidth, window.innerHeight);
            blackHoleMaterial.uniforms.u_resolution.value.set(window.innerWidth, window.innerHeight);
    }, false);
};
