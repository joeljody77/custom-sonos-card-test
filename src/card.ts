import { HomeAssistant } from 'custom-card-helpers';
import { css, html, LitElement } from 'lit';
import { property, state } from 'lit/decorators.js';
import { choose } from 'lit/directives/choose.js';
import Store from './model/store';
import { CardConfig, Section } from './types';
import './components/footer';
import './editor/editor';
import { ACTIVE_PLAYER_EVENT, CALL_MEDIA_DONE, CALL_MEDIA_STARTED } from './constants';
import { when } from 'lit/directives/when.js';
import { styleMap } from 'lit-html/directives/style-map.js';
import { cardDoesNotContainAllSections, getHeight, getWidth, isSonosCard } from './utils/utils';

const { GROUPING, GROUPS, MEDIA_BROWSER, PLAYER, VOLUMES, QUEUE } = Section;
const TITLE_HEIGHT = 2;
const FOOTER_HEIGHT = 5;

export class Card extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property({ attribute: false }) config!: CardConfig;
  @state() section!: Section;
  @state() store!: Store;
  @state() showLoader!: boolean;
  @state() loaderTimestamp!: number;
  @state() cancelLoader!: boolean;
  @state() activePlayerId?: string;

  render() {
    this.createStore();
    let height = getHeight(this.config);
    const sections = this.config.sections;
    const showFooter = !sections || sections.length > 1;
    const footerHeight = this.config.footerHeight || FOOTER_HEIGHT;
    const contentHeight = showFooter ? height - footerHeight : height;
    const title = this.config.title;
    height = title ? height + TITLE_HEIGHT : height;
    const noPlayersText = isSonosCard(this.config)
      ? 'No supported players found'
      : "No players found. Make sure you have configured entities in the card's configuration, or configured `entityPlatform`.";
    return html`
      <ha-card style=${this.haCardStyle(height)}>
        <div class="loader" ?hidden=${!this.showLoader}>
          <ha-circular-progress indeterminate></ha-circular-progress></div
        >
        </div>
        ${title ? html`<div class="title">${title}</div>` : html``}
        <div class="content" style=${this.contentStyle(contentHeight)}>
          ${
            this.activePlayerId
              ? choose(this.section, [
                  [PLAYER, () => html` <sonos-player .store=${this.store}></sonos-player>`],
                  [
                    GROUPS,
                    () =>
                      html` <sonos-groups
                        .store=${this.store}
                        @active-player=${this.activePlayerListener}
                      ></sonos-groups>`,
                  ],
                  [
                    GROUPING,
                    () =>
                      html`<sonos-grouping
                        .store=${this.store}
                        @active-player=${this.activePlayerListener}
                      ></sonos-grouping>`,
                  ],
                  [
                    MEDIA_BROWSER,
                    () => html`
                      <sonos-media-browser
                        .store=${this.store}
                        @item-selected=${this.onMediaItemSelected}
                      ></sonos-media-browser>
                    `,
                  ],
                  [VOLUMES, () => html` <sonos-volumes .store=${this.store}></sonos-volumes>`],
                  [
                    QUEUE,
                    () =>
                      html`<sonos-queue .store=${this.store} @item-selected=${this.onMediaItemSelected}></sonos-queue>`,
                  ],
                ])
              : html`<div class="no-players">${noPlayersText}</div>`
          }
        </div>
        ${when(
          showFooter,
          () =>
            html`<sonos-footer
              style=${this.footerStyle(footerHeight)}
              .config=${this.config}
              .section=${this.section}
              @show-section=${this.showSectionListener}
            >
            </sonos-footer>`,
        )}
      </ha-card>
    `;
  }
  private createStore() {
    if (this.activePlayerId) {
      this.store = new Store(this.hass, this.config, this.section, this, this.activePlayerId);
    } else {
      this.store = new Store(this.hass, this.config, this.section, this);
      this.activePlayerId = this.store.activePlayer?.id;
    }
  }
  getCardSize() {
    return 3;
  }

  static getConfigElement() {
    return document.createElement('sonos-card-editor');
  }

  connectedCallback() {
    super.connectedCallback();
    if (cardDoesNotContainAllSections(this.config)) {
      window.addEventListener(ACTIVE_PLAYER_EVENT, this.activePlayerListener);
    }
    window.addEventListener(CALL_MEDIA_STARTED, this.callMediaStartedListener);
    window.addEventListener(CALL_MEDIA_DONE, this.callMediaDoneListener);
    window.addEventListener('hashchange', () => {
      this.activePlayerId = undefined;
      this.createStore();
    });
  }

  disconnectedCallback() {
    window.removeEventListener(ACTIVE_PLAYER_EVENT, this.activePlayerListener);
    super.disconnectedCallback();
  }

  private showSectionListener = (event: Event) => {
    const section = (event as CustomEvent).detail;
    if (!this.config.sections || this.config.sections.indexOf(section) > -1) {
      this.section = section;
    }
  };

  private callMediaStartedListener = (event: Event) => {
    if (!this.showLoader && (!this.config.sections || (event as CustomEvent).detail.section === this.section)) {
      this.cancelLoader = false;
      setTimeout(() => {
        if (!this.cancelLoader) {
          this.showLoader = true;
          this.loaderTimestamp = Date.now();
        }
      }, 300);
    }
  };

  private callMediaDoneListener = () => {
    this.cancelLoader = true;
    const duration = Date.now() - this.loaderTimestamp;
    if (this.showLoader) {
      if (duration < 1000) {
        setTimeout(() => (this.showLoader = false), 1000 - duration);
      } else {
        this.showLoader = false;
      }
    }
  };

  activePlayerListener = (event: Event) => {
    const newEntityId = (event as CustomEvent).detail.entityId;
    if (newEntityId !== this.activePlayerId) {
      this.activePlayerId = newEntityId;
      if (this.config.sections?.includes(PLAYER)) {
        this.section = PLAYER;
      }
      this.requestUpdate();
    }
  };

  private onMediaItemSelected = () => {
    if (this.config.sections?.includes(PLAYER)) {
      setTimeout(() => (this.section = PLAYER), 1000);
    }
  };

  haCardStyle(height: number) {
    const width = getWidth(this.config);
    return styleMap({
      color: 'var(--secondary-text-color)',
      height: `${height}rem`,
      minWidth: `20rem`,
      maxWidth: `${width}rem`,
      overflow: 'hidden',
    });
  }

  footerStyle(height: number) {
    return styleMap({
      height: `${height}rem`,
      padding: '0 1rem',
    });
  }

  private contentStyle(height: number) {
    return styleMap({
      overflowY: 'auto',
      height: `${height}rem`,
    });
  }

  setConfig(config: CardConfig) {
    const newConfig = JSON.parse(JSON.stringify(config));
    for (const [key, value] of Object.entries(newConfig)) {
      if (Array.isArray(value) && value.length === 0) {
        delete newConfig[key];
      }
    }
    const sections =
      newConfig.sections || Object.values(Section).filter((section) => isSonosCard(newConfig) || section !== QUEUE);
    if (newConfig.startSection && sections.includes(newConfig.startSection)) {
      this.section = newConfig.startSection;
    } else if (sections) {
      this.section = sections.includes(PLAYER)
        ? PLAYER
        : sections.includes(MEDIA_BROWSER)
          ? MEDIA_BROWSER
          : sections.includes(GROUPS)
            ? GROUPS
            : sections.includes(GROUPING)
              ? GROUPING
              : sections.includes(QUEUE) && isSonosCard(newConfig)
                ? QUEUE
                : VOLUMES;
    } else {
      this.section = PLAYER;
    }

    newConfig.favoritesItemsPerRow = newConfig.favoritesItemsPerRow || 4;
    // support custom:auto-entities
    if (newConfig.entities?.length && newConfig.entities[0].entity) {
      newConfig.entities = newConfig.entities.map((entity: { entity: string }) => entity.entity);
    }
    if (isSonosCard(newConfig)) {
      newConfig.entityPlatform = 'sonos';
      if (newConfig.showNonSonosPlayers) {
        newConfig.entityPlatform = undefined;
      }
    }
    // handle deprecated config
    if (newConfig.customSources) {
      newConfig.customFavorites = newConfig.customSources;
    }
    if (newConfig.customThumbnail) {
      newConfig.customFavoriteThumbnails = newConfig.customThumbnail;
    }
    if (newConfig.customThumbnailIfMissing) {
      newConfig.customFavoriteThumbnailsIfMissing = newConfig.customThumbnailIfMissing;
    }
    if (newConfig.mediaBrowserItemsPerRow) {
      newConfig.favoritesItemsPerRow = newConfig.mediaBrowserItemsPerRow;
    }
    this.config = newConfig;
  }

  static get styles() {
    return [
      css`
        :host {
          height: 100%;
          width: 100%;
          display: block;
        }
        .card-content {
          height: 100%;
          width: 100%;
          display: flex;
          flex-direction: column;
        }
        --mdc-icon-button-size: 3rem;
        --mdc-icon-size: 2rem;
        ha-circular-progress {
          --md-sys-color-primary: var(--accent-color);
        }
        .loader {
          position: absolute;
          z-index: 1000;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          --mdc-theme-primary: var(--accent-color);
          filter: drop-shadow(0 4px 8px #0006);
        }
        .title {
          margin: 0.8rem 0;
          text-align: center;
          font-weight: 700;
          font-size: 1.4rem;
          color: var(--primary-text-color);
          text-shadow: 0 2px 4px #0004;
          letter-spacing: 0.5px;
          background: linear-gradient(135deg, var(--primary-text-color) 0%, var(--accent-color) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .no-players {
          text-align: center;
          margin-top: 50%;
          color: var(--secondary-text-color);
          font-size: 1.1rem;
          text-shadow: 0 1px 2px #0004;
        }
        ha-card {
          border-radius: 16px;
          box-shadow: 
            0 8px 32px #0008,
            0 4px 16px #0004,
            0 0 0 1px #444;
          backdrop-filter: blur(8px) saturate(1.2);
          -webkit-backdrop-filter: blur(8px) saturate(1.2);
          background: linear-gradient(135deg, 
            rgba(26, 26, 26, 0.95) 0%, 
            rgba(42, 42, 42, 0.95) 100%);
          border: 1px solid #666;
          overflow: hidden;
          position: relative;
        }
        ha-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, 
            rgba(79, 143, 255, 0.05) 0%, 
            rgba(233, 69, 96, 0.05) 100%);
          pointer-events: none;
          z-index: 0;
        }
        .content {
          position: relative;
          z-index: 1;
        }
        .content > * {
          position: relative;
          z-index: 2;
        }
      `,
    ];
  }
}
