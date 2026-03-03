interface ScoreTablePlayer {
  userId: string;
  nickname: string;
  score: number;
  huXi: number;
  menZi: number;
  isCurrent: boolean;
}

interface ScoreTableProps {
  players: ScoreTablePlayer[];
}

export default function ScoreTable({ players }: ScoreTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/15 bg-black/30 backdrop-blur-sm">
      <table className="w-full text-left text-sm text-white/85">
        <thead className="bg-white/10 text-xs uppercase tracking-[0.2em] text-white/60">
          <tr>
            <th className="px-3 py-2">玩家</th>
            <th className="px-3 py-2">总分</th>
            <th className="px-3 py-2">胡息</th>
            <th className="px-3 py-2">门子</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr key={player.userId} className={player.isCurrent ? 'bg-[#D4A017]/10' : 'border-t border-white/10'}>
              <td className="px-3 py-2 font-medium">{player.nickname}</td>
              <td className="px-3 py-2">{player.score.toFixed(0)}</td>
              <td className="px-3 py-2">{player.huXi}</td>
              <td className="px-3 py-2">{player.menZi}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
