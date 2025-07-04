import { css, html, LitElement } from 'lit';
import { property, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import MediaControlService from '../services/media-control-service';
import Store from '../model/store';
import { dispatchActivePlayerId, getGroupingChanges } from '../utils/utils';
import { listStyle } from '../constants';
import { MediaPlayer } from '../model/media-player';
import '../components/grouping-button';
import { CardConfig, PredefinedGroup, PredefinedGroupPlayer } from '../types';
import { GroupingItem } from '../model/grouping-item';

export class Grouping extends LitElement {
  @property({ attribute: false }) store!: Store;
  private groupingItems!: GroupingItem[];
  private activePlayer!: MediaPlayer;
  private mediaControlService!: MediaControlService;
  private mediaPlayerIds!: string[];
  private notJoinedPlayers!: string[];
  private joinedPlayers!: string[];
  @state() modifiedItems: string[] = [];
  @state() selectedPredefinedGroup?: PredefinedGroup;
  private config!: CardConfig;

  render() {
    this.config = this.store.config;
    this.activePlayer = this.store.activePlayer;
    this.mediaControlService = this.store.mediaControlService;
    this.mediaPlayerIds = this.store.allMediaPlayers.map((player) => player.id);
    this.groupingItems = this.getGroupingItems();
    this.notJoinedPlayers = this.getNotJoinedPlayers();
    this.joinedPlayers = this.getJoinedPlayers();

    if (this.config.skipApplyButtonWhenGrouping && (this.modifiedItems.length > 0 || this.selectedPredefinedGroup)) {
      this.applyGrouping();
    }

    return html`
      <div class="grouping-vertical-wrapper">
        <div class="grouping-header-buttons">
          <button class="group-all-btn" @click=${this.selectAll}>GROUP ALL</button>
          <button class="ungroup-all-btn" @click=${this.deSelectAll}>UNGROUP ALL</button>
        </div>
        <div class="grouping-speaker-columns">
          ${this.groupingItems.map(
            (item) => html`
              <div class="speaker-column" ?disabled=${item.isDisabled}>
                <div class="vertical-slider-wrapper">
                  <sonos-simple-vertical-slider
                    class="vertical-volume"
                    .value=${item.player.getVolume()}
                    .max=${100}
                    .disabled=${item.isDisabled}
                    .tickCount=${12}
                    @value-changed=${(e: CustomEvent) =>
                      this.mediaControlService.volumeSet(item.player, e.detail.value, false)}
                  ></sonos-simple-vertical-slider>
                </div>
                <div class="speaker-controls">
                  <button class="mute-btn" @click=${() => this.mutePlayer(item)}>
                    <ha-icon .icon="mdi:volume-mute"></ha-icon>
                  </button>
                  <button class="group-btn" @click=${() => this.toggleItem(item)} ?selected=${item.isSelected}>
                    <ha-icon .icon="mdi:account-multiple"></ha-icon>
                  </button>
                </div>
                <div class="speaker-name">${item.name}</div>
              </div>
            `,
          )}
        </div>
      </div>
    `;
  }

  static get styles() {
    return [
      listStyle,
      css`
        :host,
        .grouping-vertical-wrapper,
        .grouping-speaker-columns {
          height: 100%;
          width: 100%;
          min-width: 0;
          min-height: 0;
          max-width: 100%;
          max-height: 100%;
          overflow: hidden;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
        }
        .grouping-speaker-columns {
          flex: 1 1 0;
          display: flex;
          flex-direction: row;
          justify-content: stretch;
          align-items: stretch;
          gap: 1.5rem;
          width: 100%;
          height: 100%;
          min-height: 0;
        }
        .speaker-column {
          flex: 1 1 0;
          min-width: 0;
          max-width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          background: none;
          min-height: 0;
        }
        .vertical-slider-wrapper,
        sonos-simple-vertical-slider {
          flex: 1 1 0;
          min-height: 0;
          width: 100%;
          max-width: 80px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          align-items: center;
        }
        sonos-simple-vertical-slider {
          max-height: 400px;
          height: 100%;
        }
        .grouping-header-buttons {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        .group-all-btn,
        .ungroup-all-btn {
          background: #23242a;
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 0.5rem 1.2rem;
          font-weight: bold;
          font-size: 1rem;
          box-shadow: 0 2px 6px #0004;
          cursor: pointer;
          transition: background 0.2s;
        }
        .group-all-btn:hover,
        .ungroup-all-btn:hover {
          background: #35363c;
        }
        .speaker-controls {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
          justify-content: center;
        }
        .mute-btn,
        .group-btn {
          background: #23242a;
          border: none;
          border-radius: 50%;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #b48aff;
          font-size: 1.3rem;
          box-shadow: 0 2px 6px #0003;
          cursor: pointer;
          transition:
            background 0.2s,
            color 0.2s;
        }
        .mute-btn:hover,
        .group-btn:hover {
          background: #35363c;
        }
        .group-btn[selected] {
          background: #b48aff;
          color: #23242a;
        }
        .speaker-name {
          margin-top: 0.3rem;
          color: #fff;
          font-size: 1rem;
          text-align: center;
          font-weight: 500;
          letter-spacing: 0.01em;
        }
        .speaker-column[disabled] {
          opacity: 0.5;
          pointer-events: none;
        }
        .grouping-vertical-wrapper,
        .card-content {
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          box-sizing: border-box !important;
        }
      `,
    ];
  }

  toggleItem(item: GroupingItem) {
    if (item.isDisabled) {
      return;
    }
    this.toggleItemWithoutDisabledCheck(item);
  }

  private toggleItemWithoutDisabledCheck(item: GroupingItem) {
    if (this.modifiedItems.includes(item.player.id)) {
      this.modifiedItems = this.modifiedItems.filter((id) => id !== item.player.id);
    } else {
      this.modifiedItems = [...this.modifiedItems, item.player.id];
    }
    this.selectedPredefinedGroup = undefined;
  }

  async applyGrouping() {
    const groupingItems = this.groupingItems;
    const joinedPlayers = this.joinedPlayers;
    const activePlayerId = this.activePlayer.id;
    const { unJoin, join, newMainPlayer } = getGroupingChanges(groupingItems, joinedPlayers, activePlayerId);
    this.modifiedItems = [];
    const selectedPredefinedGroup = this.selectedPredefinedGroup;
    this.selectedPredefinedGroup = undefined;

    if (join.length > 0) {
      await this.mediaControlService.join(newMainPlayer, join);
    }
    if (unJoin.length > 0) {
      await this.mediaControlService.unJoin(unJoin);
    }
    if (selectedPredefinedGroup) {
      await this.mediaControlService.setVolumeAndMediaForPredefinedGroup(selectedPredefinedGroup);
    }

    if (newMainPlayer !== activePlayerId && !this.config.dontSwitchPlayerWhenGrouping) {
      dispatchActivePlayerId(newMainPlayer, this.config, this);
    }
    if (this.config.entityId && unJoin.includes(this.config.entityId) && this.config.dontSwitchPlayerWhenGrouping) {
      dispatchActivePlayerId(this.config.entityId, this.config, this);
    }
  }

  private cancelGrouping() {
    this.modifiedItems = [];
  }

  private getGroupingItems() {
    const groupingItems = this.store.allMediaPlayers.map(
      (player) => new GroupingItem(player, this.activePlayer, this.modifiedItems.includes(player.id)),
    );
    const selectedItems = groupingItems.filter((item) => item.isSelected);
    if (selectedItems.length === 1) {
      selectedItems[0].isDisabled = true;
    }
    groupingItems.sort((a, b) => {
      if ((a.isMain && !b.isMain) || (a.isSelected && !b.isSelected)) {
        return -1;
      }
      return a.name.localeCompare(b.name);
    });

    return groupingItems;
  }

  private renderJoinAllButton() {
    const icon = this.config.groupingButtonIcons?.joinAll ?? 'mdi:checkbox-multiple-marked-outline';
    return when(this.notJoinedPlayers.length, () => this.groupingButton(icon, this.selectAll));
  }

  private groupingButton(icon: string, click: () => void) {
    return html` <sonos-grouping-button @click=${click} .icon=${icon}></sonos-grouping-button> `;
  }

  private getNotJoinedPlayers() {
    return this.mediaPlayerIds.filter(
      (playerId) => playerId !== this.activePlayer.id && !this.activePlayer.hasMember(playerId),
    );
  }

  private renderUnJoinAllButton() {
    const icon = this.config.groupingButtonIcons?.unJoinAll ?? 'mdi:minus-box-multiple-outline';
    return when(this.joinedPlayers.length, () => this.groupingButton(icon, this.deSelectAll));
  }

  private getJoinedPlayers() {
    return this.mediaPlayerIds.filter(
      (playerId) => playerId === this.activePlayer.id || this.activePlayer.hasMember(playerId),
    );
  }

  private renderPredefinedGroups() {
    return this.store.predefinedGroups.map((predefinedGroup) => {
      return html`
        <sonos-grouping-button
          @click=${async () => this.selectPredefinedGroup(predefinedGroup)}
          .icon=${this.config.groupingButtonIcons?.predefinedGroup ?? 'mdi:speaker-multiple'}
          .name=${predefinedGroup.name}
          .selected=${this.selectedPredefinedGroup?.name === predefinedGroup.name}
        ></sonos-grouping-button>
      `;
    });
  }

  private selectPredefinedGroup(predefinedGroup: PredefinedGroup<PredefinedGroupPlayer>) {
    this.groupingItems.forEach(async (item) => {
      const inPG = predefinedGroup.entities.some((pgp) => pgp.player.id === item.player.id);
      if ((inPG && !item.isSelected) || (!inPG && item.isSelected)) {
        this.toggleItemWithoutDisabledCheck(item);
      }
    });
    this.selectedPredefinedGroup = predefinedGroup;
  }

  private selectAll() {
    this.groupingItems.forEach((item) => {
      if (!item.isSelected) {
        this.toggleItem(item);
      }
    });
  }

  private deSelectAll() {
    this.groupingItems.forEach((item) => {
      if ((!item.isMain && item.isSelected) || (item.isMain && !item.isSelected)) {
        this.toggleItem(item);
      }
    });
  }

  mutePlayer(item: GroupingItem) {
    if (item.isDisabled) return;
    this.mediaControlService.toggleMute(item.player, false);
  }
}
