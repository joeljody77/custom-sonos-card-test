import { css, html, LitElement } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import Store from '../model/store';
import { MediaPlayer } from '../model/media-player';
import { styleMap } from 'lit-html/directives/style-map.js';

class Progress extends LitElement {
  @property({ attribute: false }) store!: Store;
  private activePlayer!: MediaPlayer;

  @state() private playingProgress!: number;
  private tracker?: NodeJS.Timeout;
  @query('.bar')
  private progressBar?: HTMLElement;
  private mediaDuration = 0;

  disconnectedCallback() {
    if (this.tracker) {
      clearInterval(this.tracker);
      this.tracker = undefined;
    }
    super.disconnectedCallback();
  }

  render() {
    this.activePlayer = this.store.activePlayer;
    this.mediaDuration = this.activePlayer?.attributes.media_duration || 0;
    const showProgress = this.mediaDuration > 0;
    if (showProgress) {
      this.trackProgress();
      return html`
        <div class="progress">
          <span class="time-display">${convertProgress(this.playingProgress)}</span>
          <div class="bar" @click=${this.handleSeek}>
            <div class="progress-track">
              <div class="progress-bar" style=${this.progressBarStyle(this.mediaDuration)}>
                <div class="progress-glow"></div>
                <div class="progress-particles"></div>
              </div>
              <div class="progress-ticks">
                ${Array.from({ length: 10 }, (_, i) => {
                  const tickPercent = i / 9;
                  const isActive = tickPercent <= (this.playingProgress / this.mediaDuration);
                  return html`<div class="progress-tick${isActive ? ' active' : ''}" style="left: ${tickPercent * 100}%"></div>`;
                })}
              </div>
            </div>
          </div>
          <span class="time-display">-${convertProgress(this.mediaDuration - this.playingProgress)}</span>
        </div>
      `;
    }
    return html``;
  }

  private async handleSeek(e: MouseEvent) {
    const progressWidth = this.progressBar!.offsetWidth;
    const percent = e.offsetX / progressWidth;
    const position = this.mediaDuration * percent;
    await this.store.mediaControlService.seek(this.activePlayer, position);
  }

  private progressBarStyle(mediaDuration: number) {
    return styleMap({ width: `${(this.playingProgress / mediaDuration) * 100}%` });
  }

  trackProgress() {
    const position = this.activePlayer?.attributes.media_position || 0;
    const playing = this.activePlayer?.isPlaying();
    const updatedAt = this.activePlayer?.attributes.media_position_updated_at || 0;
    if (playing) {
      this.playingProgress = position + (Date.now() - new Date(updatedAt).getTime()) / 1000.0;
    } else {
      this.playingProgress = position;
    }
    if (!this.tracker) {
      this.tracker = setInterval(() => this.trackProgress(), 1000);
    }
    if (!playing) {
      clearInterval(this.tracker);
      this.tracker = undefined;
    }
  }
  static get styles() {
    return css`
      .progress {
        width: 100%;
        font-size: x-small;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 0;
        --paper-progress-active-color: var(--accent-color);
      }

      .time-display {
        font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
        font-weight: 600;
        color: var(--primary-text-color);
        text-shadow: 0 1px 2px #0004;
        min-width: 32px;
        text-align: center;
      }

      .bar {
        display: flex;
        flex-grow: 1;
        align-items: center;
        padding: 8px 0;
        cursor: pointer;
        position: relative;
      }

      .progress-track {
        position: relative;
        width: 100%;
        height: 8px;
        background: linear-gradient(180deg, #1a1a1a 0%, #2a2a2a 100%);
        border-radius: 4px;
        box-shadow: 
          0 2px 8px #0006 inset,
          0 0 0 1px #444;
        overflow: hidden;
      }

      .progress-bar {
        position: relative;
        height: 100%;
        background: linear-gradient(90deg, 
          #e94560 0%, 
          #ff6b9d 25%, 
          #4f8fff 50%, 
          #7d2fa6 75%, 
          #e94560 100%);
        border-radius: 4px;
        transition: width 0.1s linear;
        box-shadow: 
          0 0 8px #e94560,
          0 0 16px #e94560,
          0 0 24px #e94560;
        animation: progressGlow 2s ease-in-out infinite;
      }

      @keyframes progressGlow {
        0%, 100% {
          box-shadow: 
            0 0 8px #e94560,
            0 0 16px #e94560,
            0 0 24px #e94560;
        }
        50% {
          box-shadow: 
            0 0 12px #e94560,
            0 0 24px #e94560,
            0 0 36px #e94560;
        }
      }

      .progress-glow {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(90deg, 
          transparent 0%, 
          rgba(255, 255, 255, 0.3) 50%, 
          transparent 100%);
        animation: glowSweep 3s ease-in-out infinite;
        border-radius: 4px;
      }

      @keyframes glowSweep {
        0% {
          transform: translateX(-100%);
        }
        100% {
          transform: translateX(100%);
        }
      }

      .progress-particles {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-image: 
          radial-gradient(circle at 20% 50%, #fff2 0%, transparent 50%),
          radial-gradient(circle at 80% 50%, #fff2 0%, transparent 50%);
        animation: particleFloat 4s ease-in-out infinite;
        border-radius: 4px;
      }

      @keyframes particleFloat {
        0%, 100% {
          opacity: 0.3;
          transform: translateY(0px);
        }
        50% {
          opacity: 0.7;
          transform: translateY(-2px);
        }
      }

      .progress-ticks {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
      }

      .progress-tick {
        position: absolute;
        top: 50%;
        transform: translate(-50%, -50%);
        width: 2px;
        height: 4px;
        background: #666;
        border-radius: 1px;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .progress-tick.active {
        background: #fff;
        height: 6px;
        box-shadow: 
          0 0 4px #fff,
          0 0 8px #fff;
        animation: tickPulse 1.5s ease-in-out infinite;
      }

      @keyframes tickPulse {
        0%, 100% {
          opacity: 1;
          box-shadow: 
            0 0 4px #fff,
            0 0 8px #fff;
        }
        50% {
          opacity: 0.7;
          box-shadow: 
            0 0 6px #fff,
            0 0 12px #fff;
        }
      }

      .bar:hover .progress-track {
        box-shadow: 
          0 2px 12px #0008 inset,
          0 0 0 1px #666;
      }

      .bar:hover .progress-bar {
        filter: brightness(1.2);
      }
    `;
  }
}

const convertProgress = (duration: number) => {
  const date = new Date(duration * 1000).toISOString().substring(11, 19);
  return date.startsWith('00:') ? date.substring(3) : date;
};

customElements.define('sonos-progress', Progress);
