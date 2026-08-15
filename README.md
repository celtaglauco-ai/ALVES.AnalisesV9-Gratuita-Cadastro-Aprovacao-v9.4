# ALVES.AnalisesV11 Profissional

Aplicação Next.js pronta para Render Free, com PostgreSQL gratuito permanente no Neon, autenticação administrativa no servidor e análise estatística gratuita por IA via OpenRouter.

## Segurança

- Sessão administrativa em cookie `HttpOnly`, assinada por HMAC e com duração de 8 horas.
- Senha armazenada apenas como hash `scrypt` com salt.
- Inclusão, atualização e exclusão de ligas protegidas no servidor.
- Visitantes não recebem a interface administrativa.
- Novos cadastros começam como pendentes e somente entram depois da aprovação do administrador.
- O administrador pode aceitar, recusar, bloquear ou excluir usuários.
- As rotas de ligas e IA exigem uma sessão de usuário aprovada ou de administrador.
- Limite básico de 12 consultas de IA por minuto por IP.

Consulte `INSTRUCOES-RENDER.txt` para publicar.

Esta edição não cria banco no Render: `DATABASE_URL` deve receber a conexão de um projeto Neon Free. O código da IA usa somente `openrouter/free` e nunca seleciona automaticamente um modelo pago.

## Atualização da V10 para V11

Substitua os arquivos do mesmo repositório. Mantenha `DATABASE_URL`, `SESSION_SECRET` e `OPENROUTER_API_KEY`. A V11 reutiliza as tabelas existentes e adiciona sua atualização automaticamente, preservando usuários, aprovações, ligas e partidas.

Na importação, **Cadastrar nova liga** sempre cria um identificador exclusivo. **Atualizar liga existente** só substitui o CSV da liga escolhida explicitamente. País, nome, temporada e código podem ser editados sem apagar partidas.

## Novidades da V11

- Cadastro de vários usuários com ID exclusivo e e-mail único, sem substituir cadastros anteriores.
- Classificação Geral, Mandante e Visitante calculada para todas as ligas cadastradas.
- Forma dos últimos cinco jogos em V, E e D, comparativo casa/fora e confrontos diretos.
- Estatísticas do árbitro quando o CSV contém a coluna `Referee`.
- Leitura opcional de xG, posse e faltas quando essas colunas existirem.
- Integração com a Football-Data.org para classificação atual Geral/Mandante/Visitante, partidas e placares. O CSV continua sendo a fonte das estatísticas detalhadas e do histórico complementar.
- Ligas compartilhadas são cadastradas somente pelo administrador. Cada usuário possui ID, configurações e histórico privados em tabelas separadas por `user_id`.

Para atualizar o mesmo site, preserve `DATABASE_URL`, `SESSION_SECRET`, `OPENROUTER_API_KEY` e `FOOTBALL_DATA_TOKEN`. A Football-Data.org fornece as classificações e partidas das competições liberadas; o sistema usa cache e atualização automática.

## Atualização automática e histórico gerado pela API

A versão atualizada guarda a classificação oficial e as partidas encerradas separadamente dos CSVs manuais. Ela atualiza somente a temporada cadastrada, preserva a última resposta válida em caso de falha e permite baixar um CSV por time nas condições Geral, Mandante e Visitante.

No Render, mantenha `CRON_SECRET` criado pelo `render.yaml`. No GitHub, crie dois segredos do repositório: `SITE_URL` com o endereço público do site sem barra final e `CRON_SECRET` com o mesmo valor usado no Render. O fluxo `.github/workflows/atualizar-futebol.yml` fará uma atualização diária após o encerramento dos jogos. O botão do Painel Admin permite atualizar todas as ligas a qualquer momento, e a liga selecionada também usa cache inteligente.

O plano grátis da Football-Data.org limita a quantidade de competições e requisições. O sistema respeita o intervalo gratuito e exibe publicamente somente ligas atualizadas com sucesso. Estatísticas detalhadas como cantos e finalizações vêm do CSV associado quando disponíveis; valores ausentes nunca são inventados.
