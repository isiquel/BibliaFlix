# Bíbliaflix Profissional — Fase 2 Bíblia Completa

Esta versão mudou a estratégia corretamente: o texto completo da Bíblia não fica dentro do index.html.

O aplicativo carrega cada capítulo completo pela API pública GetBible, usando a tradução `almeida`.
Quando um capítulo é aberto, ele é salvo no localStorage do aparelho para abrir mais rápido depois.

## Estrutura
- `index.html`: estrutura principal
- `css/style.css`: visual premium
- `js/app.js`: lógica do app, leitura, áudio, favoritos, progresso e carregamento da Bíblia completa
- `data/books.json`: catálogo dos 66 livros
- `data/stories.json`: histórias bíblicas expandidas
- `data/characters.json`: personagens bíblicos
- `assets/covers/`: capas em SVG

## Importante
Para funcionar corretamente, suba a pasta inteira no Vercel/GitHub Pages. Abrir apenas o index.html como arquivo local pode bloquear o carregamento de dados dependendo do navegador.

## Bíblia completa
Todos os livros e capítulos ficam disponíveis pela API quando o usuário abre o capítulo. Também existe botão para baixar um livro para leitura offline no aparelho.
