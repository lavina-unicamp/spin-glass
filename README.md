# Spin Glass 3D Simulation

Simulação 3D interativa do tempo de relaxação de nanopartículas magnéticas (MNPs) para diferentes valores do índice entrópico `q` (Néel-Brown, sub-difusivo, super-difusivo e vidro de spin), construída com [Three.js](https://threejs.org/) e [MathJax](https://www.mathjax.org/).

Interactive 3D simulation of the relaxation time of magnetic nanoparticles (MNPs) for different values of the entropic index `q`, built with Three.js and MathJax.

## Estrutura / Structure

```
spin-glass-3d-simulation/
├── index.html      # Estrutura da página / page markup
├── css/
│   └── style.css   # Estilos / styles
├── js/
│   └── main.js     # Física, cena 3D, UI, gravação e traduções
└── README.md
```

## Como executar / How to run

As bibliotecas (Three.js, OrbitControls e MathJax) são carregadas por CDN, então é necessário acesso à internet.

```bash
# opção 1: abrir index.html diretamente no navegador
# opção 2: servidor local
python3 -m http.server 8000
# acesse http://localhost:8000
```

## Uso / Usage

- Escolha um estado `q` no menu para ver a equação de τ, o valor calculado e a animação dos dipolos.
- Arraste para rotacionar, role para dar zoom, botão direito para mover a câmera.
- Use o botão **Idioma** para alternar entre português e inglês.
- Use o painel **Gravar Vídeo** para exportar um trecho da simulação (MP4 ou WebM, conforme o navegador).
