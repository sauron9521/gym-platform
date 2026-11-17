import { ImageResponse } from 'next/og';

export const alt = 'Gym Platform — тренування та прогрес';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          padding: 76,
          background: '#161b21',
          color: '#f1f4f5',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 700, color: '#c5ef5b' }}>
          GYM PLATFORM
        </div>
        <div style={{ marginTop: 42, fontSize: 72, fontWeight: 800, lineHeight: 1.12 }}>
          Тренуйся розумніше.
        </div>
        <div style={{ marginTop: 10, fontSize: 72, fontWeight: 800, color: '#c5ef5b' }}>
          Прогресуй далі.
        </div>
        <div style={{ marginTop: 42, fontSize: 27, color: '#b0bac6' }}>
          Платформа для спортсменів і тренерів
        </div>
      </div>
    ),
    size,
  );
}
