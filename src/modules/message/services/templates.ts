import { env } from '../../../shared/config/env.js';
import type { DomainEvent, EventType } from '../../../shared/events.js';
import type { Mail } from '../providers/smtp.js';

export type Category = 'venc' | 'orc' | 'meta' | 'inv';

const CATEGORY: Partial<Record<EventType, Category>> = {
  'bill.due_soon': 'venc',
  'invoice.due_soon': 'venc',
  'invoice.overdue': 'venc',
  'financing.installment_due_soon': 'venc',
  'consortium.installment_due_soon': 'venc',
  'income.not_received': 'venc',
  'balance.projected_negative': 'venc',
  'card.limit_near': 'orc',
  'budget.threshold': 'orc',
  'subscription.price_increased': 'orc',
  'goal.reached': 'meta',
  'investment.dividend_incoming': 'inv',
  'investment.price_target_hit': 'inv',
};

export const categoryOf = (type: EventType): Category | undefined => CATEGORY[type];

export interface InAppContent {
  title: string;
  body: string;
  href: string;
}

const brl = (v: unknown) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const str = (v: unknown, fallback = '') => (v === undefined || v === null ? fallback : String(v));
const days = (v: unknown) => (Number(v) === 0 ? 'hoje' : Number(v) === 1 ? 'amanhã' : `em ${Number(v)} dias`);

/** Conteúdo da notificação in-app/push a partir do evento. Devolve undefined para eventos sem notificação. */
export function inAppContent(event: DomainEvent): InAppContent | undefined {
  const p = event.payload as Record<string, unknown>;
  switch (event.type) {
    case 'bill.due_soon':
      return { title: `${str(p['name'], 'Conta')} vence ${days(p['days'])}`, body: `${brl(p['amount'])} · vencimento ${str(p['dueDate'])}.`, href: '/calendario' };
    case 'invoice.due_soon':
      return { title: `Fatura ${str(p['card'])} vence ${days(p['days'])}`, body: `${brl(p['amount'])}. Toque para pagar.`, href: '/fatura' };
    case 'invoice.overdue':
      return { title: `Fatura ${str(p['card'])} vencida`, body: `${brl(p['amount'])} em aberto desde ${str(p['dueDate'])}.`, href: '/fatura' };
    case 'financing.installment_due_soon':
      return { title: `Parcela de ${str(p['name'], 'financiamento')} vence ${days(p['days'])}`, body: `${brl(p['amount'])}.`, href: '/dividas' };
    case 'consortium.installment_due_soon':
      return { title: `Parcela do consórcio vence ${days(p['days'])}`, body: `${str(p['name'])} · ${brl(p['amount'])}.`, href: '/dividas' };
    case 'income.not_received':
      return { title: `${str(p['name'], 'Receita')} ainda não recebida`, body: `Previsto para ${str(p['dueDate'])}: ${brl(p['amount'])}.`, href: '/extrato' };
    case 'card.limit_near':
      return { title: `Limite do ${str(p['card'])} quase no máximo`, body: `${str(p['percent'])}% do limite comprometido.`, href: '/carteira' };
    case 'budget.threshold':
      return { title: `Orçamento de ${str(p['category'])} em ${str(p['percent'])}%`, body: `${brl(p['spent'])} de ${brl(p['limit'])}.`, href: '/planejamento' };
    case 'goal.reached':
      return { title: `Meta alcançada: ${str(p['goal'])}`, body: 'Parabéns! Você chegou ao valor desejado.', href: '/planejamento' };
    case 'balance.projected_negative':
      return { title: 'Saldo projetado negativo', body: `${str(p['wallet'])} pode ficar em ${brl(p['amount'])} em ${str(p['date'])}.`, href: '/calendario' };
    case 'subscription.price_increased':
      return { title: 'Assinatura mais cara', body: `${str(p['name'])} subiu de ${brl(p['from'])} para ${brl(p['to'])}.`, href: '/recorrentes' };
    case 'investment.dividend_incoming':
      return { title: 'Provento a caminho', body: `${str(p['ticker'])} vai pagar ${brl(p['amount'])} em ${str(p['date'])}.`, href: '/inv-carteira' };
    case 'investment.price_target_hit':
      return { title: `${str(p['ticker'])} chegou no preço-alvo`, body: `Cotação ${brl(p['price'])} · alvo ${brl(p['target'])}.`, href: '/inv-radar' };
    default:
      return undefined;
  }
}

/** Base dos links do app: APP_URL (web/universal link) ou o esquema nativo prumo://. */
const linkBase = () => (env.APP_URL ? `${env.APP_URL.replace(/\/$/, '')}/` : 'prumo://');
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

function layout(title: string, paragraphs: string[], cta?: { label: string; url: string }): string {
  const body = paragraphs.map((t) => `<p style="margin:0 0 14px;color:#2b2f36;font-size:15px;line-height:1.5">${esc(t)}</p>`).join('');
  const button = cta ? `<p style="margin:22px 0"><a href="${esc(cta.url)}" style="background:#4C7DF0;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700">${esc(cta.label)}</a></p>` : '';
  return `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px"><h2 style="margin:0 0 18px;color:#121316">${esc(title)}</h2>${body}${button}<p style="color:#8A9099;font-size:12px;margin-top:28px">Prumo · se você não reconhece esta ação, ignore este e-mail.</p></div>`;
}

/** E-mails transacionais da conta (verificação e redefinição de senha). */
export function transactionalMail(event: DomainEvent, to: string): Mail | undefined {
  const p = event.payload as Record<string, unknown>;
  const name = str(p['name'], 'olá');
  if (event.type === 'user.registered' && p['verifyToken']) {
    const token = str(p['verifyToken']);
    const url = `${linkBase()}verificar-email?token=${encodeURIComponent(token)}`;
    return {
      to,
      subject: 'Confirme seu e-mail no Prumo',
      text: `Olá, ${name}! Confirme seu e-mail abrindo: ${url}\nCódigo: ${token}`,
      html: layout('Confirme seu e-mail', [`Olá, ${name}! Falta só confirmar seu e-mail para ativar a conta.`, `Se o botão não abrir, use o código: ${token}`], { label: 'Confirmar e-mail', url }),
    };
  }
  if (event.type === 'user.password_reset_requested' && p['resetToken']) {
    const token = str(p['resetToken']);
    const url = `${linkBase()}redefinir-senha?token=${encodeURIComponent(token)}`;
    return {
      to,
      subject: 'Redefinir sua senha do Prumo',
      text: `Olá, ${name}. Para criar uma nova senha, abra: ${url}\nCódigo: ${token}\nO link vale por 1 hora.`,
      html: layout('Redefinir senha', [`Olá, ${name}. Recebemos um pedido para redefinir sua senha. O link vale por 1 hora.`, `Se o botão não abrir, use o código: ${token}`], { label: 'Criar nova senha', url }),
    };
  }
  return undefined;
}

export function notificationMail(content: InAppContent, to: string): Mail {
  return {
    to,
    subject: content.title,
    text: `${content.title}\n${content.body}`,
    html: layout(content.title, [content.body]),
  };
}
