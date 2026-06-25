type LogButtonProps = {
  onRecord: () => void;
  disabled: boolean;
};

export default function LogButton({ onRecord, disabled }: LogButtonProps) {
  return (
    <section className="record-dock" aria-label="記録操作">
      <div className="dock-handle" aria-hidden="true" />
      <div className="dock-copy">
        <span>仮の作業記録</span>
        <strong>{disabled ? "今日は満ちています" : "少しだけ満たす"}</strong>
      </div>
      <button className="record-button" type="button" onClick={onRecord} disabled={disabled}>
        記録する
      </button>
    </section>
  );
}
