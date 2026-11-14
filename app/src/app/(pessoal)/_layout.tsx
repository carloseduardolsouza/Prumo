import { AccountTabs } from '@/ui/tabs';

export default function Layout() {
  return (
    <AccountTabs
      inv={false}
      tabs={[['inicio', 'Início'], ['extrato', 'Extrato'], ['dashboard', 'Dashboard'], ['carteira', 'Carteira'], ['perfil', 'Perfil']]}
      hidden={['fatura', 'calendario', 'planejamento', 'dividas', 'recorrentes', 'notificacoes', 'saude', 'patrimonio', 'movimentacao', 'recorrencia', 'novo-cartao', 'compra', 'dados', 'seguranca', 'sessoes', 'categorias', 'regiao', 'privacidade', 'config-notificacoes', 'nova-conta', 'nova-meta', 'nova-divisao', 'importar', 'meta', 'financiamento', 'novo-financiamento', 'consorcio', 'novo-consorcio']}
    />
  );
}
