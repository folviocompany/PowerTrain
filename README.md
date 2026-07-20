# PowerTreino Gustavo

Aplicação web pessoal para acompanhamento de treino de powerlifting raw, em português do Brasil, com dados salvos no navegador por LocalStorage e base preparada para PWA.

## O que está implementado

- Dashboard com peso corporal, meta, semana do bloco, e1RM, Training Max, volume e gráficos.
- Menu dedicado de Máximas para ajustar agachamento, supino e terra de forma simples.
- Programa inicial de 6 semanas + deload na semana 7, com 4 dias de treino.
- Cálculos de e1RM por Epley, Brzycki ou Lombardi.
- Training Max configurável de 80% a 100%.
- Arredondamento para 1 kg, 1,25 kg, 2 kg, 2,5 kg ou 5 kg.
- Aquecimento automático editável para agachamento, supino e terra.
- Tela de treino com séries, RPE, vídeo, observações, falha técnica, dor e cronômetro.
- Histórico com filtros, duplicação, exclusão e exportação JSON.
- Progressão com gráficos de volume, RPE e total estimado.
- Registro de peso corporal com média de 7 dias, variação semanal e distância para a meta.
- Área de competição com contagem regressiva, fases, calculadora de tentativas e checklist.
- Cadastro de equipamentos com status IPF Approved preenchido pelo usuário.
- Configurações, importação, exportação, backup e reinício de dados.
- Manifest e service worker para uso offline quando servido por HTTP local.

## Ajuste rápido das máximas

Use o menu `Máximas` ou o botão `Ajustar máximas` no Dashboard.

1. Informe a melhor série recente de agachamento, supino e terra.
2. Confira o e1RM calculado e o Training Max na própria tela.
3. Ajuste fórmula, percentual do Training Max e incremento se precisar.
4. Clique em `Salvar máximas`.

As máximas salvas manualmente passam a ter prioridade sobre o histórico antigo. Para voltar ao cálculo automático pela melhor série registrada, use `Usar melhores do histórico`.

## Como executar

Opção simples:

1. Abra `index.html` no navegador.
2. Os dados serão criados automaticamente com o perfil inicial do Gustavo.

Opção recomendada para PWA e service worker:

```bash
python -m http.server 8000
```

Depois acesse:

```text
http://localhost:8000
```

O service worker só é registrado fora de `file://`, por regra dos navegadores.

## Deploy na Vercel

O projeto é um site estático sem etapa de build. O arquivo `vercel.json` fixa:

- Build Command: nenhum
- Output Directory: raiz do projeto (`.`)
- cache curto para `service-worker.js`

Na Vercel, use o preset `Other` se precisar configurar manualmente. Se houver override no painel da Vercel, deixe o Build Command vazio e o Output Directory como `.`.

## Como instalar como PWA

1. Execute por servidor local, por exemplo `python -m http.server 8000`.
2. Abra `http://localhost:8000` no Chrome, Edge ou navegador compatível.
3. Use a opção de instalação do navegador.
4. Depois da primeira carga, os arquivos locais ficam em cache. O Chart.js é carregado por CDN inicialmente e também é tentado no cache do service worker.

Para tornar o app 100% independente da internet no futuro, baixe o arquivo `chart.umd.min.js`, coloque em `js/vendor/` e troque o script do CDN por esse arquivo local.

## Dados iniciais

- Nome: Gustavo
- Altura: 1,70 m
- Peso corporal inicial: 100 kg
- Meta: 92 a 93 kg
- Modalidade: Powerlifting Raw
- Objetivo: competir em campeonato regional em aproximadamente 1 ano
- Agachamento: 110 kg x 3, e1RM aproximado de 121 kg
- Supino: 90 kg x 2, e1RM aproximado de 96 kg
- Terra: 110 kg x 1, e1RM aproximado de 114 kg pela fórmula Epley

Observação: pela fórmula informada, `110 x (1 + 1/30)` resulta em aproximadamente 113,7 kg. O app usa a fórmula exatamente, então o terra inicial aparece arredondado perto de 114 kg, não 110 kg.

## Avisos

O aplicativo não substitui treinador, médico ou nutricionista. Alterações relevantes de peso, alimentação ou saúde devem ser acompanhadas por profissional qualificado. Singles são tratados como prática técnica, não como teste de máximo.
