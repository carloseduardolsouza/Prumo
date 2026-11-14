import { AccountTabs } from '@/ui/tabs';

export default function Layout() {
  return (
    <AccountTabs
      inv={true}
      tabs={[['inv-inicio', 'Início'], ['inv-extrato', 'Extrato'], ['inv-dashboard', 'Dashboard'], ['inv-carteira', 'Carteira'], ['inv-perfil', 'Perfil']]}
      hidden={['inv-simulador', 'inv-ir', 'inv-radar', 'inv-novo-ativo', 'inv-corretoras', 'inv-cotacoes']}
    />
  );
}
