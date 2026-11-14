import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';
import { meApi, type SessionInfo } from '@/api/auth';
import { Badge, Btn, Card, I, Notice, Row, Screen, T, useP } from '@/ui/kit';
import { C } from '@/ui/theme';
import { errorMessage } from '@/state/session';

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function Sessoes() {
  const p = useP();
  const [lista, setLista] = useState<SessionInfo[] | null>(null);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    try {
      setLista(await meApi.sessions());
    } catch (e) {
      setErro(errorMessage(e));
    }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const encerrar = async (id: string) => {
    try { await meApi.revokeSession(id); await carregar(); } catch (e) { setErro(errorMessage(e)); }
  };
  const encerrarOutras = async () => {
    try { await meApi.revokeOtherSessions(); await carregar(); } catch (e) { setErro(errorMessage(e)); }
  };

  return (
    <Screen eyebrow="Conta" title="Sessões e dispositivos" back>
      <T s={13} c={p.sub}>Dispositivos conectados à sua conta. Encerre os que você não reconhece.</T>
      {erro ? <Notice kind="err">{erro}</Notice> : null}
      {!lista && !erro && <ActivityIndicator color={p.accent} />}
      {lista?.map((s) => (
        <Card key={s.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Badge d={I.phone} color={s.current ? C.green : p.sub} size={42} bg={p.card2} />
          <Row style={{ flex: 1, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            <T s={14} w="700">{s.deviceName}</T>
            <T s={12} c={p.mute}>{s.current ? 'agora' : `último uso ${quando(s.lastUsedAt)}`}{s.ip ? ` · ${s.ip}` : ''}</T>
          </Row>
          {s.current ? <T s={11} w="800" c={C.green}>ATUAL</T> : (
            <Pressable accessibilityLabel={`Encerrar ${s.deviceName}`} onPress={() => encerrar(s.id)} style={{ minHeight: 44, justifyContent: 'center' }}><T s={13} w="800" c={p.red}>Encerrar</T></Pressable>
          )}
        </Card>
      ))}
      {lista && lista.length > 1 && <Btn kind="ghost" onPress={encerrarOutras}>Encerrar todas as outras sessões</Btn>}
    </Screen>
  );
}
