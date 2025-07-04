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
                  <sonos-volume
                    class="vertical-volume"
                    .store=${this.store}
                    .player=${item.player}
                    .updateMembers=${false}
                    .slim=${true}
                    orientation="vertical"
                  ></sonos-volume>
                  <!-- Placeholder for colored tick marks and dynamic color effects -->
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
        .grouping-vertical-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 100%;
          background: #18191c;
          border-radius: 12px;
          padding: 1rem;
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
        .grouping-speaker-columns {
          display: flex;
          flex-direction: row;
          justify-content: center;
          align-items: flex-end;
          gap: 2.5rem;
          width: 100%;
        }
        .speaker-column {
          display: flex;
          flex-direction: column;
          align-items: center;
          background: none;
          min-width: 70px;
        }
        .vertical-slider-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 160px;
          margin-bottom: 1rem;
        }
        .vertical-volume {
          /* Placeholder for vertical slider styling */
          writing-mode: bt-lr;
          transform: rotate(-90deg);
          height: 140px;
          width: 32px;
        }
        .speaker-controls {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
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
