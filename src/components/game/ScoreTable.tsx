import clsx from 'clsx';

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
    <div className="overflow-hidden rounded-lg border border-yellow-800/40 bg-black/60 backdrop-blur-sm">
      <table className="w-full text-left text-sm text-white/85">
        <thead className="border-b border-yellow-900/30 bg-white/5 text-sm font-bold text-yellow-300">
          <tr>
            <th className="px-3 py-2">玩家</th>
            <th className="px-3 py-2">总分</th>
            <th className="px-3 py-2">胡息</th>
            <th className="px-3 py-2">门子</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player, index) => (
            <tr
              key={player.userId}
              className={clsx(
                'border-t border-yellow-900/30',
                index % 2 === 0 ? 'bg-white/5' : 'bg-transparent'
              )}
            >
              <td className="px-3 py-2 font-medium">{player.nickname}</td>
              <td
                className={clsx(
                  'px-3 py-2 font-semibold',
                  player.score > 0 && 'text-red-400',
                  player.score < 0 && 'text-green-400'
                )}
              >
                {player.score.toFixed(0)}
              </td>
              <td className="px-3 py-2">{player.huXi}</td>
              <td className="px-3 py-2">{player.menZi}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
