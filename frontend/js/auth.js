function protegerPagina(modulo) {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (!token || !userStr) {
        window.location.href = 'login.html';
        return null;
    }

    const user = JSON.parse(userStr);

    if (modulo && !user.modulosPermitidos.includes(modulo)) {
        alert(`No tienes permiso para acceder al módulo: ${modulo}`);
        window.location.href = 'dashboard.html';
        return null;
    }

    return user;
}


function renderizarUsuario() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.querySelectorAll('.user-name').forEach(el => {
        el.textContent = user.nombre || 'Usuario';
    });
    document.querySelectorAll('.user-rol').forEach(el => {
        el.textContent = user.rol || '';
    });
}


async function hacerLogin(event) {
    event.preventDefault();

    const usuario = document.getElementById('usuario').value.trim();
    const password = document.getElementById('password').value;
    const btn = document.getElementById('btnLogin');

    btn.disabled = true;
    btn.textContent = 'Ingresando...';

    try {
        const response = await fetch('http://localhost:3000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.msg || 'Error al iniciar sesión');
        }

        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        if (data.user.modulosPermitidos.includes('dashboard')) {
            window.location.href = 'dashboard.html';
        } else if (data.user.modulosPermitidos.includes('ventas')) {
            window.location.href = 'ventas.html';
        } else if (data.user.modulosPermitidos.includes('calidad')) {
            window.location.href = 'calidad.html';
        } else if (data.user.modulosPermitidos.includes('fabricacion')) {
            window.location.href = 'fabricacion.html';
        } else {
            window.location.href = 'dashboard.html';
        }

    } catch (error) {
        alert('❌ ' + error.message);
        btn.disabled = false;
        btn.textContent = 'Iniciar Sesión';
    }
}