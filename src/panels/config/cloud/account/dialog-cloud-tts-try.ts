import "@material/mwc-button";
import { mdiPlayCircleOutline, mdiRobot } from "@mdi/js";
import "@polymer/paper-input/paper-textarea";
import type { PaperTextareaElement } from "@polymer/paper-input/paper-textarea";
import "@polymer/paper-item/paper-item";
import "@polymer/paper-listbox/paper-listbox";
import { css, CSSResultGroup, html, LitElement, TemplateResult } from "lit";
import { customElement, property, state, query } from "lit/decorators";
import { LocalStorage } from "../../../../common/decorators/local-storage";
import { fireEvent } from "../../../../common/dom/fire_event";
import { computeStateDomain } from "../../../../common/entity/compute_state_domain";
import { computeStateName } from "../../../../common/entity/compute_state_name";
import { supportsFeature } from "../../../../common/entity/supports-feature";
import { createCloseHeading } from "../../../../components/ha-dialog";
import "../../../../components/ha-paper-dropdown-menu";
import { showAutomationEditor } from "../../../../data/automation";
import { SUPPORT_PLAY_MEDIA } from "../../../../data/media-player";
import { convertTextToSpeech } from "../../../../data/tts";
import { showAlertDialog } from "../../../../dialogs/generic/show-dialog-box";
import { haStyleDialog } from "../../../../resources/styles";
import { HomeAssistant } from "../../../../types";
import { TryTtsDialogParams } from "./show-dialog-cloud-tts-try";

@customElement("dialog-cloud-try-tts")
export class DialogTryTts extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @state() private _loadingExample = false;

  @state() private _params?: TryTtsDialogParams;

  @query("#message") private _messageInput?: PaperTextareaElement;

  @LocalStorage("cloudTtsTryMessage", false, false) private _message!: string;

  @LocalStorage("cloudTtsTryTarget", false, false) private _target!: string;

  public showDialog(params: TryTtsDialogParams) {
    this._params = params;
  }

  public closeDialog() {
    this._params = undefined;
    fireEvent(this, "dialog-closed", { dialog: this.localName });
  }

  protected render(): TemplateResult {
    if (!this._params) {
      return html``;
    }
    const target = this._target || "browser";
    return html`
      <ha-dialog
        open
        @closed=${this.closeDialog}
        scrimClickAction
        escapeKeyAction
        .heading=${createCloseHeading(
          this.hass,
          this.hass.localize("ui.panel.config.cloud.account.tts.dialog.header")
        )}
      >
        <div>
          <paper-textarea
            id="message"
            label="Message"
            .value=${this._message ||
            this.hass.localize(
              "ui.panel.config.cloud.account.tts.dialog.example_message",
              "name",
              this.hass.user!.name
            )}
          >
          </paper-textarea>

          <ha-paper-dropdown-menu
            .label=${this.hass.localize(
              "ui.panel.config.cloud.account.tts.dialog.target"
            )}
          >
            <paper-listbox
              id="target"
              slot="dropdown-content"
              attr-for-selected="item-value"
              .selected=${target}
              @selected-changed=${this._handleTargetChanged}
            >
              <paper-item item-value="browser">
                ${this.hass.localize(
                  "ui.panel.config.cloud.account.tts.dialog.target_browser"
                )}
              </paper-item>
              ${Object.values(this.hass.states)
                .filter(
                  (entity) =>
                    computeStateDomain(entity) === "media_player" &&
                    supportsFeature(entity, SUPPORT_PLAY_MEDIA)
                )
                .map(
                  (entity) => html`
                    <paper-item .itemValue=${entity.entity_id}>
                      ${computeStateName(entity)}
                    </paper-item>
                  `
                )}
            </paper-listbox>
          </ha-paper-dropdown-menu>
        </div>
        <mwc-button
          slot="primaryAction"
          .label=${this.hass.localize(
            "ui.panel.config.cloud.account.tts.dialog.play"
          )}
          @click=${this._playExample}
          .disabled=${this._loadingExample}
        >
          <ha-svg-icon slot="icon" .path=${mdiPlayCircleOutline}></ha-svg-icon>
        </mwc-button>
        <mwc-button
          slot="secondaryAction"
          .disabled=${target === "browser"}
          .label=${this.hass.localize(
            "ui.panel.config.cloud.account.tts.dialog.create_automation"
          )}
          @click=${this._createAutomation}
        >
          <ha-svg-icon slot="icon" .path=${mdiRobot}></ha-svg-icon>
        </mwc-button>
      </ha-dialog>
    `;
  }

  private _handleTargetChanged(ev) {
    this._target = ev.detail.value;
    this.requestUpdate("_target");
  }

  private async _playExample() {
    const message = this._messageInput?.value;
    if (!message) {
      return;
    }
    this._message = message;

    if (this._target === "browser") {
      // We create the audio element here + do a play, because iOS requires it to be done by user action
      const audio = new Audio();
      audio.play();
      this._playBrowser(message, audio);
    } else {
      this.hass.callService("tts", "cloud_say", {
        entity_id: this._target,
        message,
      });
    }
  }

  private _createAutomation() {
    const message = this._messageInput!.value!;
    this._message = message;
    showAutomationEditor({
      action: [
        {
          service: "tts.cloud_say",
          data: {
            entity_id: this._target,
            message: message,
          },
        },
      ],
    });
    this.closeDialog();
  }

  private async _playBrowser(message: string, audio: HTMLAudioElement) {
    this._loadingExample = true;

    const language = this._params!.defaultVoice[0];
    const gender = this._params!.defaultVoice[1];

    let url;
    try {
      const result = await convertTextToSpeech(this.hass, {
        platform: "cloud",
        message,
        language,
        options: { gender },
      });
      url = result.path;
    } catch (err: any) {
      this._loadingExample = false;
      showAlertDialog(this, {
        text: `Unable to load example. ${err.error || err.body || err}`,
        warning: true,
      });
      return;
    }
    audio.src = url;
    audio.addEventListener("canplaythrough", () => {
      audio.play();
    });
    audio.addEventListener("playing", () => {
      this._loadingExample = false;
    });
    audio.addEventListener("error", () => {
      showAlertDialog(this, { title: "Error playing audio." });
      this._loadingExample = false;
    });
  }

  static get styles(): CSSResultGroup {
    return [
      haStyleDialog,
      css`
        ha-dialog {
          --mdc-dialog-max-width: 500px;
        }
      `,
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "dialog-cloud-try-tts": DialogTryTts;
  }
}
