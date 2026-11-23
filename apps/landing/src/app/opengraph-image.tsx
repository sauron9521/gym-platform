import { ImageResponse } from 'next/og';

export const alt = 'OVRANTO — тренуйся з метою. Прогресуй.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        padding: 76,
        background: '#F5F0E9',
        color: '#1C262A',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 700, color: '#075C55' }}>OVRANTO</div>
      <div style={{ marginTop: 42, fontSize: 72, fontWeight: 800, lineHeight: 1.12 }}>
        Тренуйся з метою.
      </div>
      <div style={{ marginTop: 10, fontSize: 72, fontWeight: 800, color: '#075C55' }}>
        Прогресуй.
      </div>
      <div style={{ marginTop: 42, fontSize: 27, color: '#59666D' }}>
        Платформа для спортсменів і тренерів
      </div>
    </div>,
    size,
  );
}
