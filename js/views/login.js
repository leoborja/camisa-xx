import { esc } from '../ui.js';
import { ICONE } from '../icones.js';

export const tela = 'login';

export function render(root, { store }) {
  root.innerHTML = `
    <div class="login">
      <div class="login-marca">${ICONE.camisa}</div>
      <h1>Camisa XX</h1>
      <p class="sub">Acervo de camisas</p>
      <form id="f-login" class="cartao" autocomplete="on">
        <label class="campo"><span>E-mail</span>
          <input type="email" name="email" required autocomplete="username" inputmode="email" autocapitalize="off"></label>
        <label class="campo"><span>Senha</span>
          <input type="password" name="senha" required autocomplete="current-password"></label>
        <p class="erro-msg" id="erro" hidden></p>
        <button class="btn btn-primario btn-cheio" type="submit">Entrar</button>
      </form>
    </div>`;
  const f = root.querySelector('#f-login');
  const erro = root.querySelector('#erro');
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const btn = f.querySelector('button');
    btn.disabled = true; btn.textContent = 'Entrando…'; erro.hidden = true;
    try {
      await store.entrar(f.email.value.trim(), f.senha.value);
    } catch (e) {
      erro.innerHTML = esc(/invalid/i.test(e.message) ? 'E-mail ou senha incorretos.' : e.message);
      erro.hidden = false;
      btn.disabled = false; btn.textContent = 'Entrar';
    }
  });
}
