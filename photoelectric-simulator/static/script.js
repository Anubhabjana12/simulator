// Global variables
let scene, camera, renderer, photons = [], electrons = [];
let electronEjected = false;
let photonColor = 0xffff00; // Default yellow
let electronVelocityScale = 1.0; // Default scale

// Metal work functions in eV
const workFunctions = {
    'cesium': 2.14,
    'potassium': 2.3,
    'sodium': 2.7,
    'copper': 4.3,
    'platinum': 5.1
};

// Constants
const PLANCK_CONSTANT = 6.626e-34; // J⋅s
const ELECTRON_CHARGE = 1.602e-19; // C
const SPEED_OF_LIGHT = 2.998e8; // m/s

// Initialize Three.js
function initThreeJS() {
    const canvas = document.getElementById('simCanvas');
    
    // Set canvas size to match its CSS dimensions
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); // Black background for better visibility

    // Camera setup
    camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
    camera.position.set(0, 15, 35);
    camera.lookAt(0, 0, 0);

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(canvas.width, canvas.height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(20, 20, 20);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Light Source (visual representation)
    const lightSourceGeometry = new THREE.SphereGeometry(1.5, 32, 32);
    const lightSourceMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 0.8
    });
    const lightSource = new THREE.Mesh(lightSourceGeometry, lightSourceMaterial);
    lightSource.position.set(-25, 10, 10);
    scene.add(lightSource);

    // Adding a cone to represent the light beam
    const coneGeometry = new THREE.ConeGeometry(5, 10, 32);
    const coneMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffffff,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide
    });
    const cone = new THREE.Mesh(coneGeometry, coneMaterial);
    cone.position.set(-20, 10, 10);
    cone.rotation.z = Math.PI / 2;
    scene.add(cone);

    // Metal Surface
    const surfaceGeometry = new THREE.BoxGeometry(40, 2, 20);
    const surfaceMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x888888, 
        shininess: 100,
        specular: 0x111111
    });
    const surface = new THREE.Mesh(surfaceGeometry, surfaceMaterial);
    surface.position.y = -5;
    surface.receiveShadow = true;
    scene.add(surface);

    // Add coordinate grid for reference (optional)
    const gridHelper = new THREE.GridHelper(50, 50, 0x555555, 0x333333);
    gridHelper.position.y = -6;
    scene.add(gridHelper);

    // Handle window resize
    window.addEventListener('resize', onWindowResize);
    
    // Initialize charts
    initCharts();
}

function onWindowResize() {
    const canvas = document.getElementById('simCanvas');
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    camera.aspect = canvas.width / canvas.height;
    camera.updateProjectionMatrix();
    renderer.setSize(canvas.width, canvas.height);
}

function createPhoton() {
    const geometry = new THREE.SphereGeometry(0.3, 16, 16);
    const material = new THREE.MeshBasicMaterial({ color: photonColor });
    const photon = new THREE.Mesh(geometry, material);
    photon.position.set(-25, 10, 10); // Start at light source
    
    // Add a point light to each photon for visual effect
    const photonLight = new THREE.PointLight(photonColor, 0.5, 5);
    photon.add(photonLight);
    
    scene.add(photon);
    return photon;
}

function createElectron(x, z) {
    const geometry = new THREE.SphereGeometry(0.3, 16, 16);
    const material = new THREE.MeshBasicMaterial({ color: 0x00aaff });
    const electron = new THREE.Mesh(geometry, material);
    electron.position.set(x, -4, z); // Start just above surface
    
    // Scale velocity based on kinetic energy
    const speed = 0.2 * electronVelocityScale;
    electron.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * speed, // Random x velocity
        speed * 2.5, // Upward velocity
        (Math.random() - 0.5) * speed  // Random z velocity
    );
    
    // Add a trail effect
    const trailGeometry = new THREE.BufferGeometry();
    const trailMaterial = new THREE.LineBasicMaterial({
        color: 0x00aaff,
        transparent: true,
        opacity: 0.7
    });
    
    const trailPositions = new Float32Array(30 * 3); // 30 points, 3 values per point (x,y,z)
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    
    electron.trail = new THREE.Line(trailGeometry, trailMaterial);
    electron.trailPositions = Array(30).fill().map(() => new THREE.Vector3());
    scene.add(electron.trail);
    
    scene.add(electron);
    return electron;
}

function updateTrails() {
    electrons.forEach(electron => {
        if (electron.trail) {
            // Shift all positions in the trail
            for (let i = electron.trailPositions.length - 1; i > 0; i--) {
                electron.trailPositions[i].copy(electron.trailPositions[i - 1]);
            }
            
            // Add current position
            electron.trailPositions[0].copy(electron.position);
            
            // Update the trail geometry
            const positions = electron.trail.geometry.attributes.position.array;
            for (let i = 0; i < electron.trailPositions.length; i++) {
                const pos = electron.trailPositions[i];
                positions[i * 3] = pos.x;
                positions[i * 3 + 1] = pos.y;
                positions[i * 3 + 2] = pos.z;
            }
            
            electron.trail.geometry.attributes.position.needsUpdate = true;
        }
    });
}

function animate() {
    requestAnimationFrame(animate);

    // Update photons
    for (let i = photons.length - 1; i >= 0; i--) {
        const photon = photons[i];
        photon.position.x += 0.5;
        photon.position.y -= 0.25;
        
        // Wave-like motion for photons (quantum wave-particle duality visualization)
        photon.position.z += Math.sin(Date.now() * 0.005 + i) * 0.02;

        // Check if photon hits the surface
        if (photon.position.y <= -4) {
            if (electronEjected && electrons.length < 10) {
                electrons.push(createElectron(photon.position.x, photon.position.z));
            }
            scene.remove(photon);
            photons.splice(i, 1);
        }
    }

    // Update electrons
    for (let i = electrons.length - 1; i >= 0; i--) {
        const electron = electrons[i];
        electron.position.add(electron.velocity);
        electron.velocity.y -= 0.01; // Gravity effect
        
        // Electron rotation for visual effect
        electron.rotation.x += 0.02;
        electron.rotation.y += 0.03;
        
        // Remove electrons that go out of bounds
        if (electron.position.y < -20 || electron.position.x > 40 || 
            electron.position.x < -40 || electron.position.z > 40 || 
            electron.position.z < -40) {
            scene.remove(electron);
            if (electron.trail) scene.remove(electron.trail);
            electrons.splice(i, 1);
        }
    }
    
    // Update electron trails
    updateTrails();

    renderer.render(scene, camera);
}

// Charts
let energyFrequencyChart, kineticEnergyChart;

function initCharts() {
    // Photon Energy vs Frequency chart
    const energyCtx = document.getElementById('energyFrequencyChart').getContext('2d');
    energyFrequencyChart = new Chart(energyCtx, {
        type: 'line',
        data: {
            labels: Array.from({length: 16}, (_, i) => i),
            datasets: [{
                label: 'Photon Energy (eV)',
                data: Array.from({length: 16}, (_, i) => calculatePhotonEnergy(i * 1e14) / ELECTRON_CHARGE),
                borderColor: '#00bcd4',
                backgroundColor: 'rgba(0, 188, 212, 0.2)',
                borderWidth: 2,
                pointRadius: 3,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Frequency (×10¹⁴ Hz)',
                        color: 'rgba(255, 255, 255, 0.7)'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Energy (eV)',
                        color: 'rgba(255, 255, 255, 0.7)'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    }
                }
            }
        }
    });
    
    // Kinetic Energy vs Frequency chart
    const kineticCtx = document.getElementById('kineticEnergyChart').getContext('2d');
    kineticEnergyChart = new Chart(kineticCtx, {
        type: 'line',
        data: {
            labels: Array.from({length: 16}, (_, i) => i),
            datasets: []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Frequency (×10¹⁴ Hz)',
                        color: 'rgba(255, 255, 255, 0.7)'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Kinetic Energy (eV)',
                        color: 'rgba(255, 255, 255, 0.7)'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    }
                }
            }
        }
    });
    
    // Update kinetic energy chart for default selected metal
    updateKineticEnergyChart();
}

function updateKineticEnergyChart() {
    const metalSelect = document.getElementById('metalSelect');
    const selectedMetal = metalSelect.value;
    const workFunction = workFunctions[selectedMetal];
    
    // Calculate threshold frequency
    const thresholdFrequency = (workFunction * ELECTRON_CHARGE) / PLANCK_CONSTANT;
    const thresholdFrequencyScale = thresholdFrequency / 1e14;
    
    // Generate data points
    const kineticData = Array.from({length: 16}, (_, i) => {
        const frequency = i * 1e14;
        const photonEnergy = calculatePhotonEnergy(frequency);
        const kineticEnergy = Math.max(0, (photonEnergy - workFunction * ELECTRON_CHARGE) / ELECTRON_CHARGE);
        return kineticEnergy;
    });

    // Update chart data
    if (kineticEnergyChart.data.datasets.length === 0) {
        kineticEnergyChart.data.datasets.push({
            label: `${metalSelect.options[metalSelect.selectedIndex].text}`,
            data: kineticData,
            borderColor: '#18ffff',
            backgroundColor: 'rgba(24, 255, 255, 0.2)',
            borderWidth: 2,
            pointRadius: 3,
            tension: 0.1
        });
    } else {
        kineticEnergyChart.data.datasets[0].label = `${metalSelect.options[metalSelect.selectedIndex].text}`;
        kineticEnergyChart.data.datasets[0].data = kineticData;
    }
    
    kineticEnergyChart.update();
}

// Physics calculations
function calculatePhotonEnergy(frequency) {
    return PLANCK_CONSTANT * frequency; // Energy in Joules
}

function calculateWavelength(frequency) {
    return SPEED_OF_LIGHT / frequency * 1e9; // wavelength in nm
}

function simulate() {
    const frequencyInput = parseFloat(document.getElementById('frequency').value);
    const intensityInput = parseFloat(document.getElementById('intensity').value);
    const metalSelect = document.getElementById('metalSelect');
    const metal = metalSelect.value;
    
    // Validate input
    if (isNaN(frequencyInput) || frequencyInput < 0) {
        alert('Please enter a valid frequency (≥ 0).');
        return;
    }
    
    if (!metal) {
        alert('Please select a metal.');
        return;
    }

    // Scale frequency from 10^14 Hz to Hz
    const frequency = frequencyInput * 1e14;
    
    // Get work function for selected metal
    const workFunction = workFunctions[metal]; // in eV
    
    // Calculate threshold frequency
    const thresholdFrequency = (workFunction * ELECTRON_CHARGE) / PLANCK_CONSTANT;
    
    // Convert work function from eV to Joules
    const workFunctionJ = workFunction * ELECTRON_CHARGE;
    
    // Calculate photon energy in Joules, then convert to eV
    const photonEnergyJ = calculatePhotonEnergy(frequency);
    const photonEnergyEV = photonEnergyJ / ELECTRON_CHARGE;
    
    // Calculate kinetic energy of ejected electron (if any)
    const kineticEnergyJ = Math.max(0, photonEnergyJ - workFunctionJ);
    const kineticEnergyEV = kineticEnergyJ / ELECTRON_CHARGE;
    
    // Determine if electrons are ejected
    electronEjected = frequency >= thresholdFrequency;
    
    // Calculate wavelength in nm
    const wavelengthNM = calculateWavelength(frequency);
    
    // Set the relative velocity scale for ejected electrons
    electronVelocityScale = electronEjected ? Math.sqrt(kineticEnergyEV) : 0;
    
    // Set photon color based on wavelength (approximate visible spectrum)
    if (wavelengthNM >= 380 && wavelengthNM < 450) {
        photonColor = 0x9400d3; // Violet
    } else if (wavelengthNM >= 450 && wavelengthNM < 495) {
        photonColor = 0x0000ff; // Blue
    } else if (wavelengthNM >= 495 && wavelengthNM < 570) {
        photonColor = 0x00ff00; // Green
    } else if (wavelengthNM >= 570 && wavelengthNM < 590) {
        photonColor = 0xffff00; // Yellow
    } else if (wavelengthNM >= 590 && wavelengthNM < 620) {
        photonColor = 0xff7f00; // Orange
    } else if (wavelengthNM >= 620 && wavelengthNM <= 750) {
        photonColor = 0xff0000; // Red
    } else {
        // Outside visible spectrum
        photonColor = wavelengthNM < 380 ? 0x9400d3 : 0xff0000; // UV or IR (display as violet or red)
    }
    
    // Clear existing particles
    clearSimulation();
    
    // Update results display
    document.getElementById('photon-energy').textContent = photonEnergyEV.toFixed(2) + ' eV';
    document.getElementById('work-function').textContent = workFunction.toFixed(2) + ' eV';
    document.getElementById('threshold-frequency').textContent = (thresholdFrequency / 1e14).toFixed(2) + ' ×10¹⁴ Hz';
    document.getElementById('wavelength').textContent = wavelengthNM.toFixed(0) + ' nm';
    document.getElementById('kinetic-energy').textContent = kineticEnergyEV.toFixed(2) + ' eV';
    
    const electronEjectedElement = document.getElementById('electron-ejected');
    electronEjectedElement.textContent = electronEjected ? 'Yes' : 'No';
    electronEjectedElement.className = electronEjected ? 'value highlight-value' : 'value error-value';
    
    // Update physics explanation
    document.getElementById('physics-explanation').innerHTML = getPhysicsExplanation({
        photon_energy_eV: photonEnergyEV.toFixed(2),
        work_function_eV: workFunction.toFixed(2),
        kinetic_energy_eV: kineticEnergyEV.toFixed(2),
        electron_ejected: electronEjected
    });
    
    // Update kinetic energy chart
    updateKineticEnergyChart();
    
    // Spawn photons at a rate proportional to intensity
    const photonCount = Math.max(5, Math.floor(intensityInput / 10));
    spawnPhotons(photonCount);
}

function spawnPhotons(count) {
    for (let i = 0; i < count; i++) {
        setTimeout(() => {
            if (document.visibilityState !== 'hidden') {
                photons.push(createPhoton());
            }
        }, i * 300); // Staggered spawn every 300ms
    }
}

function clearSimulation() {
    // Remove all photons
    photons.forEach(photon => scene.remove(photon));
    photons = [];
    
    // Remove all electrons and their trails
    electrons.forEach(electron => {
        scene.remove(electron);
        if (electron.trail) scene.remove(electron.trail);
    });
    electrons = [];
}

function getPhysicsExplanation(data) {
    if (data.electron_ejected) {
        return `
            The incident light has sufficient energy (${data.photon_energy_eV} eV) to overcome 
            the work function of ${data.work_function_eV} eV for ${document.getElementById('metalSelect').options[document.getElementById('metalSelect').selectedIndex].text.split(' ')[0]}. 
            The ejected electrons have a kinetic energy of ${data.kinetic_energy_eV} eV, following 
            Einstein's photoelectric equation: E<sub>k</sub> = hf - φ
        `;
    } else {
        return `
            The incident light has insufficient energy (${data.photon_energy_eV} eV) to overcome 
            the work function of ${data.work_function_eV} eV for ${document.getElementById('metalSelect').options[document.getElementById('metalSelect').selectedIndex].text.split(' ')[0]}. 
            According to Einstein's photoelectric equation, the photon energy (hf) must exceed 
            the work function (φ) for electrons to be ejected.
        `;
    }
}

// Connect sliders and number inputs
function connectInputs() {
    const frequencySlider = document.getElementById('frequencySlider');
    const frequencyInput = document.getElementById('frequency');
    const intensitySlider = document.getElementById('intensitySlider');
    const intensityInput = document.getElementById('intensity');
    const metalSelect = document.getElementById('metalSelect');
    
    // Connect frequency slider to input
    frequencySlider.addEventListener('input', () => {
        frequencyInput.value = frequencySlider.value;
    });
    
    frequencyInput.addEventListener('input', () => {
        frequencySlider.value = frequencyInput.value;
    });
    
    // Connect intensity slider to input
    intensitySlider.addEventListener('input', () => {
        intensityInput.value = intensitySlider.value;
    });
    
    intensityInput.addEventListener('input', () => {
        intensitySlider.value = intensityInput.value;
    });
    
    // Update chart when metal is changed
    metalSelect.addEventListener('change', updateKineticEnergyChart);
}

// Initialize Three.js and start animation
document.addEventListener('DOMContentLoaded', () => {
    initThreeJS();
    animate();
    connectInputs();
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            simulate();
        }
    });
});