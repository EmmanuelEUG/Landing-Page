document.addEventListener('DOMContentLoaded', () => {
    // Mobile navigation toggle
    const navToggle = document.querySelector('.nav-toggle');
    const navLinks = document.querySelector('.nav-links');

    if (navToggle && navLinks) {
        navToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            navToggle.classList.toggle('open');
        });

        // Close mobile nav when clicking a link
        document.querySelectorAll('.nav-links a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
                navToggle.classList.remove('open');
            });
        });
    }

    // Reveal on scroll, using GSAP when available and CSS otherwise.
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const motionTargets = document.querySelectorAll(
        '.proyecto-card, .evento-card, .skill-card, .cert-item, .blog-section'
    );
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (window.gsap && !prefersReducedMotion) {
        gsap.from('.hero-sub, .hero-titulo, .hero-descripcion, .btn-cta-group', {
            y: 28,
            opacity: 0,
            duration: 0.85,
            stagger: 0.12,
            ease: 'power3.out',
            delay: 0.12
        });
        gsap.from('.sobre-mi-foto-marco', {
            scale: 0.86,
            opacity: 0,
            rotateY: -18,
            duration: 1.2,
            ease: 'expo.out',
            delay: 0.2
        });
    }

    if ('IntersectionObserver' in window && !prefersReducedMotion) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;

                if (window.gsap) {
                    gsap.fromTo(entry.target,
                        { y: 34, opacity: 0, rotateX: 3 },
                        { y: 0, opacity: 1, rotateX: 0, duration: 0.75, ease: 'power3.out', clearProps: 'transform' }
                    );
                } else {
                    entry.target.classList.add('reveal');
                }

                observer.unobserve(entry.target);
            });
        }, observerOptions);

        motionTargets.forEach(el => {
            el.classList.add('reveal-init');
            observer.observe(el);
        });
    }

    // Pointer-driven 3D tilt adds depth without changing card layout.
    const canUseTilt = window.matchMedia('(hover: hover) and (pointer: fine)').matches
        && !prefersReducedMotion;

    if (canUseTilt) {
        document.querySelectorAll('.proyecto-card, .evento-card, .skill-card').forEach(card => {
            card.addEventListener('pointermove', event => {
                const bounds = card.getBoundingClientRect();
                const x = (event.clientX - bounds.left) / bounds.width - 0.5;
                const y = (event.clientY - bounds.top) / bounds.height - 0.5;
                card.style.setProperty('--tilt-x', `${-y * 7}deg`);
                card.style.setProperty('--tilt-y', `${x * 9}deg`);
                card.style.setProperty('--spot-x', `${(x + 0.5) * 100}%`);
                card.style.setProperty('--spot-y', `${(y + 0.5) * 100}%`);
            });

            card.addEventListener('pointerleave', () => {
                card.style.setProperty('--tilt-x', '0deg');
                card.style.setProperty('--tilt-y', '0deg');
            });
        });
    }

    // Three.js scenes: a full-screen particle field follows scroll progress,
    // while a separate orbital object adds depth around the accessible portrait.
    const canvas = document.querySelector('.hero-canvas');
    const ambientCanvas = document.querySelector('.ambient-particles');
    if ((canvas || ambientCanvas) && !prefersReducedMotion) {
        import('https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js')
            .then(THREE => {
                let ambientScene;

                if (ambientCanvas) {
                    const renderer = new THREE.WebGLRenderer({
                        canvas: ambientCanvas,
                        alpha: true,
                        antialias: false,
                        powerPreference: 'low-power'
                    });
                    const isSmallScreen = window.innerWidth < 700;
                    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmallScreen ? 1 : 1.35));
                    renderer.setClearColor(0x000000, 0);

                    const scene = new THREE.Scene();
                    const camera = new THREE.PerspectiveCamera(56, 1, 0.1, 90);
                    camera.position.z = isSmallScreen ? 21 : 18;

                    const field = new THREE.Group();
                    scene.add(field);

                    const colorCyan = new THREE.Color(0x67e8f9);
                    const colorViolet = new THREE.Color(0xa78bfa);
                    const colorPink = new THREE.Color(0xf472b6);
                    const colorCore = new THREE.Color(0xe9ddff);
                    const geometries = [];
                    const materials = [];
                    const maxRadius = isSmallScreen ? 5.8 : 10.2;

                    const createParticleLayer = (count, size, opacity, makeParticle, blending = THREE.AdditiveBlending) => {
                        const geometry = new THREE.SphereGeometry(1, 8, 6);
                        const material = new THREE.MeshBasicMaterial({
                            color: 0xffffff,
                            transparent: true,
                            opacity,
                            blending,
                            depthWrite: false,
                            toneMapped: false
                        });
                        const layer = new THREE.InstancedMesh(geometry, material, count);
                        layer.instanceMatrix.setUsage(THREE.StaticDrawUsage);
                        const color = new THREE.Color();
                        const particleTransform = new THREE.Object3D();
                        const worldPerPixel = (2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(56) / 2))
                            / Math.max(window.innerHeight, 1);

                        for (let i = 0; i < count; i++) {
                            const particle = makeParticle(i, count);
                            color.copy(particle.color);
                            const diameter = (particle.size ?? size * (0.68 + Math.random() * 1.05)) * worldPerPixel;
                            particleTransform.position.set(particle.x, particle.y, particle.z);
                            particleTransform.scale.setScalar(Math.max(diameter * 0.5, 0.018));
                            particleTransform.updateMatrix();
                            layer.setMatrixAt(i, particleTransform.matrix);
                            layer.setColorAt(i, color);
                        }

                        layer.instanceMatrix.needsUpdate = true;
                        if (layer.instanceColor) layer.instanceColor.needsUpdate = true;
                        field.add(layer);
                        geometries.push(geometry);
                        materials.push(material);
                        return layer;
                    };

                    // Spiral-arm dust: individual glowing points orbiting a bright core.
                    const armCount = isSmallScreen ? 2600 : 6000;
                    const spiral = createParticleLayer(armCount, isSmallScreen ? 2.5 : 2.3, 0.95, (i, count) => {
                        const arm = i % 4;
                        const radius = Math.pow(Math.random(), 0.72) * maxRadius;
                        const swirl = radius * 0.82;
                        const scatter = (0.16 + radius * 0.045) * (Math.random() - 0.5);
                        const angle = arm * Math.PI * 0.5 + swirl + scatter;
                        const hue = THREE.MathUtils.clamp(radius / maxRadius, 0, 1);
                        const particleColor = hue < 0.56
                            ? colorCyan.clone().lerp(colorViolet, hue / 0.56)
                            : colorViolet.clone().lerp(colorPink, (hue - 0.56) / 0.44);
                        const brightParticle = Math.random() > 0.9;
                        const armGlow = brightParticle ? colorCore : particleColor;
                        return {
                            x: Math.cos(angle) * radius,
                            y: Math.sin(angle) * radius * (isSmallScreen ? 0.76 : 0.62),
                            z: (Math.random() - 0.5) * (0.18 + radius * 0.04),
                            color: armGlow,
                            size: brightParticle ? 9 + Math.random() * 5 : 5 + Math.random() * 4
                        };
                    });

                    // Dense luminous core, with a softer surrounding nebula.
                    const core = createParticleLayer(isSmallScreen ? 760 : 1600, isSmallScreen ? 4 : 4.2, 1, () => {
                        const angle = Math.random() * Math.PI * 2;
                        const radius = Math.pow(Math.random(), 2.3) * (isSmallScreen ? 1.15 : 1.55);
                        return {
                            x: Math.cos(angle) * radius,
                            y: Math.sin(angle) * radius * 0.82,
                            z: (Math.random() - 0.5) * 0.6,
                            color: Math.random() > 0.28 ? colorCore : colorPink,
                            size: 7 + Math.random() * 8
                        };
                    });

                    const nebula = createParticleLayer(isSmallScreen ? 500 : 900, isSmallScreen ? 3.4 : 3.1, 0.12, () => {
                        const angle = Math.random() * Math.PI * 2;
                        const radius = Math.sqrt(Math.random()) * maxRadius;
                        const colorPick = Math.random();
                        const particleColor = colorPick < 0.5
                            ? colorCyan
                            : colorPick < 0.82 ? colorViolet : colorPink;
                        return {
                            x: Math.cos(angle) * radius,
                            y: Math.sin(angle) * radius * (isSmallScreen ? 0.76 : 0.62),
                            z: (Math.random() - 0.5) * 0.4,
                            color: particleColor,
                            size: 4.5 + Math.random() * 4
                        };
                    });

                    const distantStars = createParticleLayer(isSmallScreen ? 120 : 220, isSmallScreen ? 2.2 : 2, 0.5, () => ({
                        x: (Math.random() - 0.5) * (isSmallScreen ? 15 : 38),
                        y: (Math.random() - 0.5) * (isSmallScreen ? 19 : 26),
                        z: -4 - Math.random() * 4,
                        color: Math.random() > 0.65 ? colorViolet : colorCyan,
                        size: 3 + Math.random() * 3
                    }), THREE.NormalBlending);

                    field.rotation.z = -0.16;
                    field.position.x = isSmallScreen ? 0 : 2.4;

                    ambientScene = {
                        progress: 0,
                        setProgress(value) {
                            this.progress = THREE.MathUtils.clamp(value, 0, 1);
                        }
                    };

                    let pointerX = 0;
                    let pointerY = 0;
                    const onPointerMove = event => {
                        pointerX = (event.clientX / window.innerWidth - 0.5) * 0.5;
                        pointerY = (event.clientY / window.innerHeight - 0.5) * 0.35;
                    };
                    window.addEventListener('pointermove', onPointerMove, { passive: true });

                    const resize = () => {
                        const width = window.innerWidth;
                        const height = window.innerHeight;
                        renderer.setSize(width, height, false);
                        camera.aspect = width / height;
                        camera.updateProjectionMatrix();
                    };
                    window.addEventListener('resize', resize, { passive: true });
                    resize();

                    let frameId;
                    const animate = time => {
                        frameId = requestAnimationFrame(animate);
                        const progress = ambientScene.progress;
                        field.rotation.z = -0.16 + progress * 0.72 + Math.sin(time * 0.00008) * 0.025;
                        field.rotation.x += (-pointerY * 0.18 + 0.2 - field.rotation.x) * 0.014;
                        field.rotation.y += (pointerX * 0.16 + Math.sin(time * 0.00007) * 0.035 - field.rotation.y) * 0.012;
                        field.position.y = Math.sin(progress * Math.PI * 2) * 1.2;
                        camera.position.z = (isSmallScreen ? 21 : 18) - progress * (isSmallScreen ? 2.8 : 4.2);
                        camera.position.x = Math.sin(progress * Math.PI * 2) * 0.72 + pointerX * 0.3;
                        camera.position.y = Math.cos(progress * Math.PI * 2) * 0.52 + pointerY * 0.24;
                        camera.lookAt(0, 0, 0);
                        spiral.material.opacity = 0.78 + (Math.sin(time * 0.0011) + 1) * 0.1;
                        core.material.opacity = 0.84 + (Math.sin(time * 0.0017) + 1) * 0.12;
                        nebula.rotation.z = -field.rotation.z * 0.22;
                        distantStars.rotation.z = field.rotation.z * 0.035;
                        renderer.render(scene, camera);
                    };
                    animate(0);

                    if (window.gsap && window.ScrollTrigger) {
                        gsap.registerPlugin(ScrollTrigger);
                        ScrollTrigger.create({
                            trigger: document.documentElement,
                            start: 'top top',
                            end: 'bottom bottom',
                            onUpdate: self => ambientScene.setProgress(self.progress)
                        });

                        gsap.utils.toArray('.titulo-seccion').forEach(heading => {
                            gsap.fromTo(heading,
                                { y: 38, opacity: 0 },
                                {
                                    y: 0,
                                    opacity: 1,
                                    duration: 0.8,
                                    ease: 'power3.out',
                                    scrollTrigger: {
                                        trigger: heading,
                                        start: 'top 88%',
                                        toggleActions: 'play none none reverse'
                                    }
                                }
                            );
                        });
                    } else {
                        let ticking = false;
                        const updateFromScroll = () => {
                            if (ticking) return;
                            ticking = true;
                            requestAnimationFrame(() => {
                                const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
                                ambientScene.setProgress(scrollableHeight > 0 ? window.scrollY / scrollableHeight : 0);
                                ticking = false;
                            });
                        };
                        window.addEventListener('scroll', updateFromScroll, { passive: true });
                    }

                    window.addEventListener('pagehide', () => {
                        cancelAnimationFrame(frameId);
                        window.removeEventListener('pointermove', onPointerMove);
                        window.removeEventListener('resize', resize);
                        geometries.forEach(geometry => geometry.dispose());
                        materials.forEach(material => material.dispose());
                        renderer.dispose();
                    }, { once: true });
                }

                if (!canvas) return;

                const renderer = new THREE.WebGLRenderer({
                    canvas,
                    alpha: true,
                    antialias: true,
                    powerPreference: 'low-power'
                });
                renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
                renderer.setClearColor(0x000000, 0);

                const scene = new THREE.Scene();
                const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
                camera.position.z = 8;

                const group = new THREE.Group();
                scene.add(group);

                const particleCount = window.innerWidth < 700 ? 420 : 850;
                const positions = new Float32Array(particleCount * 3);
                const colors = new Float32Array(particleCount * 3);
                const orbitColors = [new THREE.Color(0x67e8f9), new THREE.Color(0xa78bfa), new THREE.Color(0xf472b6)];
                for (let i = 0; i < particleCount; i++) {
                    const i3 = i * 3;
                    const angle = Math.random() * Math.PI * 2;
                    const radius = 2.15 + Math.random() * 0.8;
                    positions[i3] = Math.cos(angle) * radius;
                    positions[i3 + 1] = Math.sin(angle) * radius * 0.68;
                    positions[i3 + 2] = (Math.random() - 0.5) * 1.1;
                    const color = orbitColors[i % orbitColors.length];
                    colors[i3] = color.r;
                    colors[i3 + 1] = color.g;
                    colors[i3 + 2] = color.b;
                }

                const particleGeometry = new THREE.BufferGeometry();
                particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
                const orbitCanvas = document.createElement('canvas');
                orbitCanvas.width = 64;
                orbitCanvas.height = 64;
                const orbitContext = orbitCanvas.getContext('2d');
                const orbitGradient = orbitContext.createRadialGradient(32, 32, 0, 32, 32, 32);
                orbitGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
                orbitGradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.92)');
                orbitGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                orbitContext.fillStyle = orbitGradient;
                orbitContext.fillRect(0, 0, 64, 64);
                const orbitTexture = new THREE.CanvasTexture(orbitCanvas);
                const particles = new THREE.Points(particleGeometry, new THREE.PointsMaterial({
                    map: orbitTexture,
                    alphaTest: 0.015,
                    size: 0.1,
                    vertexColors: true,
                    transparent: true,
                    opacity: 0.8,
                    sizeAttenuation: true
                }));
                group.add(particles);

                const resize = () => {
                    const { width, height } = canvas.getBoundingClientRect();
                    if (!width || !height) return;
                    renderer.setSize(width, height, false);
                    camera.aspect = width / height;
                    camera.updateProjectionMatrix();
                };

                const resizeObserver = new ResizeObserver(resize);
                resizeObserver.observe(canvas);
                resize();

                let pointerX = 0;
                let pointerY = 0;
                const sceneTarget = canvas.parentElement;
                const onPointerMove = event => {
                    const rect = sceneTarget.getBoundingClientRect();
                    pointerX = ((event.clientX - rect.left) / rect.width - 0.5) * 0.35;
                    pointerY = ((event.clientY - rect.top) / rect.height - 0.5) * 0.25;
                };
                sceneTarget.addEventListener('pointermove', onPointerMove, { passive: true });

                let frameId;
                const animate = time => {
                    frameId = requestAnimationFrame(animate);
                    group.rotation.y += (pointerX - group.rotation.y) * 0.018;
                    group.rotation.x += (-pointerY - group.rotation.x) * 0.018;
                    particles.rotation.z = time * 0.000035;
                    particles.rotation.x = Math.sin(time * 0.00016) * 0.12;
                    particles.rotation.y = time * 0.000035;
                    renderer.render(scene, camera);
                };
                animate(0);

                window.addEventListener('pagehide', () => {
                    cancelAnimationFrame(frameId);
                    resizeObserver.disconnect();
                    sceneTarget.removeEventListener('pointermove', onPointerMove);
                    particleGeometry.dispose();
                    orbitTexture.dispose();
                    renderer.dispose();
                }, { once: true });
            })
            .catch(error => console.info('3D hero disabled; using CSS fallback.', error));
    }
});
