export function initParticles(canvas) {
    const ctx = canvas.getContext("2d");
    const W = canvas.width = window.innerWidth;
    const H = canvas.height = window.innerHeight;

    let particles = [];

    for (let i = 0; i < 1500; i++) {
        particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: Math.random() - 0.5,
        vy: Math.random() - 0.5,
        size: 1.2,
        });
    }

    function animate() {
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = "#00ff99";

        for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;

        ctx.fillRect(p.x, p.y, p.size, p.size);
        }

        requestAnimationFrame(animate);
    }

    animate();
    }