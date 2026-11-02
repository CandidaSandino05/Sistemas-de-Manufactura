const CONFIG_RBAC = {
    admin: {
        home: 'dashboard.html',
        modulos: ['dashboard', 'inventario', 'compras', 'fabricacion', 'calidad', 'ventas', 'sensores']
    },
    administrador: {
        home: 'dashboard.html',
        modulos: ['dashboard', 'inventario', 'compras', 'fabricacion', 'calidad', 'ventas', 'sensores']
    },
    fabricacion: {
        home: 'fabricacion.html',
        modulos: ['inventario', 'compras', 'fabricacion', 'sensores']
    },
    produccion: {
        home: 'fabricacion.html',
        modulos: ['inventario', 'compras', 'fabricacion', 'sensores']
    },
    ventas: {
        home: 'ventas.html',
        modulos: ['ventas']
    },
    calidad: {
        home: 'calidad.html',
        modulos: ['calidad']
    }
};

function normalizarRol(valorRol, valorUsuario) {
    const u = String(valorUsuario || '').toLowerCase().trim();
    const r = String(valorRol || '').toLowerCase().trim();

    if (u === 'ventas') return 'ventas';
    if (u === 'fabricacion' || u === 'produccion') return 'fabricacion';
    if (u === 'calidad') return 'calidad';
    if (u === 'admin' || u === 'administrador') return 'admin';

    if (r === 'ventas') return 'ventas';
    if (r === 'fabricacion' || r === 'produccion' || r === 'producción') return 'fabricacion';
    if (r === 'calidad') return 'calidad';
    if (r === 'admin' || r === 'administrador') return 'admin';

    return r || u;
}

function obtenerClaveRol(user) {
    let userObj = user;
    if (!userObj) {
        try {
            userObj = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || 'null');
        } catch (e) {
            userObj = null;
        }
    }

    if (userObj && (userObj.usuario || userObj.rol)) {
        return normalizarRol(userObj.rol, userObj.usuario);
    }

    const rolStorage = localStorage.getItem('rol') || sessionStorage.getItem('rol') || '';
    return normalizarRol(rolStorage, '');
}

function obtenerPaginaHomePorRol(rol) {
    const clave = normalizarRol(rol, '');
    if (clave === 'admin') return 'dashboard.html';
    if (clave === 'ventas') return 'ventas.html';
    if (clave === 'fabricacion') return 'fabricacion.html';
    if (clave === 'calidad') return 'calidad.html';
    return 'login.html';
}

function ejecutarGuardianRuta(moduloActual) {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (!token || !userStr) {
        window.location.href = 'login.html';
        return null;
    }

    let user = null;
    try {
        user = JSON.parse(userStr);
    } catch (e) {
        window.location.href = 'login.html';
        return null;
    }

    const rol = obtenerClaveRol(user);
    localStorage.setItem('rol', rol);
    sessionStorage.setItem('rol', rol);

    const perfil = CONFIG_RBAC[rol];
    if (!perfil) {
        window.location.href = 'login.html';
        return null;
    }

    if (moduloActual && !perfil.modulos.includes(moduloActual)) {
        if (document.body) {
            document.body.style.display = 'none';
        }
        window.location.href = obtenerPaginaHomePorRol(rol);
        return null;
    }

    return user;
}

function aplicarSeguridadVisualRBAC(moduloActual) {
    const user = ejecutarGuardianRuta(moduloActual);
    if (!user) return null;

    const rol = obtenerClaveRol(user);
    const perfil = CONFIG_RBAC[rol];
    const todosModulos = ['dashboard', 'ventas', 'inventario', 'fabricacion', 'compras', 'calidad', 'sensores'];

    todosModulos.forEach(mod => {
        const permitido = perfil.modulos.includes(mod);
        const navDesktop = document.getElementById(`menu-${mod}`);
        const navMobile = document.getElementById(`menu-${mod}-mobile`);

        if (navDesktop) {
            if (permitido) {
                navDesktop.classList.remove('d-none');
                navDesktop.style.display = 'block';
            } else {
                navDesktop.classList.add('d-none');
                navDesktop.style.setProperty('display', 'none', 'important');
            }
        }

        if (navMobile) {
            if (permitido) {
                navMobile.classList.remove('d-none');
                navMobile.style.display = 'block';
            } else {
                navMobile.classList.add('d-none');
                navMobile.style.setProperty('display', 'none', 'important');
            }
        }
    });

    const sidebar = document.getElementById('erpSidebar');
    if (sidebar && rol !== 'admin') {
        sidebar.querySelectorAll('.erp-nav-item').forEach(item => {
            const href = (item.getAttribute('href') || '').toLowerCase();
            const permitido = todosModulos.some(mod => href.includes(`${mod}.html`) && perfil.modulos.includes(mod));
            if (!permitido) {
                item.classList.add('d-none');
                item.style.setProperty('display', 'none', 'important');
            }
        });
    }

    document.querySelectorAll('a[href]').forEach(link => {
        const href = (link.getAttribute('href') || '').toLowerCase();
        todosModulos.forEach(mod => {
            if (href.includes(`${mod}.html`) && !perfil.modulos.includes(mod)) {
                if (link.classList.contains('flujo-step') || link.classList.contains('erp-nav-item')) {
                    link.classList.add('d-none');
                    link.style.setProperty('display', 'none', 'important');
                } else if (link.closest('li.nav-item')) {
                    const li = link.closest('li.nav-item');
                    li.classList.add('d-none');
                    li.style.setProperty('display', 'none', 'important');
                }
            }
        });
    });

    const barraFlujo = document.querySelector('.flujo-manufactura-bar');
    if (barraFlujo) {
        const pasosVisibles = Array.from(barraFlujo.querySelectorAll('.flujo-step')).filter(
            el => !el.classList.contains('d-none') && el.style.display !== 'none'
        );
        if (pasosVisibles.length === 3 && window.innerWidth >= 992) {
            barraFlujo.style.gridTemplateColumns = 'repeat(3, 1fr)';
        }
    }

    const logoNavbar = document.getElementById('logoNavbar');
    if (logoNavbar) {
        logoNavbar.href = perfil.home;
    }

    return user;
}

function protegerPagina(modulo) {
    return aplicarSeguridadVisualRBAC(modulo);
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
        localStorage.removeItem('rol');
        sessionStorage.removeItem('rol');

        const response = await fetch('http://localhost:3000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.msg || 'Error al iniciar sesión');
        }

        const rol = normalizarRol(data.user ? data.user.rol : '', data.user ? data.user.usuario : usuario);

        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('rol', rol);
        sessionStorage.setItem('rol', rol);

        if (rol === 'admin') {
            window.location.href = 'dashboard.html';
        } else if (rol === 'ventas') {
            window.location.href = 'ventas.html';
        } else if (rol === 'fabricacion') {
            window.location.href = 'fabricacion.html';
        } else if (rol === 'calidad') {
            window.location.href = 'calidad.html';
        } else {
            window.location.href = 'login.html';
        }
    } catch (error) {
        alert('❌ ' + error.message);
        btn.disabled = false;
        btn.textContent = 'Iniciar Sesión';
    }
}
