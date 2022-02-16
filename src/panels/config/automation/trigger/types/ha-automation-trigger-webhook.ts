import type { RequestSelectedDetail } from "@material/mwc-list/mwc-list-item";
import "../../../../../components/ha-button-menu";
import "../../../../../components/ha-check-list-item";
import "../../../../../components/ha-icon-button";
import "../../../../../components/ha-textfield";
import { UnsubscribeFunc } from "home-assistant-js-websocket";
import {
  mdiCheckboxBlankOutline,
  mdiCheckboxMarkedOutline,
  mdiCog,
  mdiContentCopy,
} from "@mdi/js";
import { css, html, LitElement, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators";
import { fireEvent } from "../../../../../common/dom/fire_event";
import { slugify } from "../../../../../common/string/slugify";
import { copyToClipboard } from "../../../../../common/util/copy-clipboard";
import type { HaTextField } from "../../../../../components/ha-textfield";
import { showToast } from "../../../../../util/toast";
import {
  WebhookTrigger,
  AutomationConfig,
} from "../../../../../data/automation";
import { HomeAssistant } from "../../../../../types";
import { handleChangeEvent } from "../ha-automation-trigger-row";

const SUPPORTED_METHODS = ["GET", "HEAD", "POST", "PUT"];
const DEFAULT_METHODS = ["POST", "PUT"];
const DEFAULT_WEBHOOK_ID = "";

@customElement("ha-automation-trigger-webhook")
export class HaWebhookTrigger extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property() public trigger!: WebhookTrigger;

  @property({ type: Boolean }) public disabled = false;

  @state() private _config?: AutomationConfig;

  private _unsub?: UnsubscribeFunc;

  public static get defaultConfig() {
    return {
      allowed_methods: [...DEFAULT_METHODS],
      local_only: true,
      webhook_id: DEFAULT_WEBHOOK_ID,
    };
  }

  connectedCallback() {
    super.connectedCallback();
    const details = {
      callback: (config) => {
        this._config = config;
      },
    };
    fireEvent(this, "subscribe-automation-config", details);
    this._unsub = (details as any).unsub;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._unsub) {
      this._unsub();
    }
  }

  private _generateWebhookId(): string {
    // The webhook_id should be treated like a password. Generate a default
    // value that would be hard for someone to guess. This generates a
    // 144-bit random value. The output is a 24 character url-safe string.
    const randomBytes = crypto.getRandomValues(new Uint8Array(18));
    const base64Str = btoa(String.fromCharCode(...randomBytes));
    const urlSafeId = base64Str.replace(/\+/g, "-").replace(/\//g, "_");

    // Include the automation name to give the user context about what the
    // webhook_id is used for.
    const urlSafeAlias = slugify(this._config?.alias || "", "-");

    return `${urlSafeAlias}-${urlSafeId}`;
  }

  public willUpdate(changedProperties: PropertyValues) {
    super.willUpdate(changedProperties);
    if (changedProperties.has("trigger")) {
      if (this.trigger.allowed_methods === undefined) {
        this.trigger.allowed_methods = [...DEFAULT_METHODS];
      }
      if (this.trigger.local_only === undefined) {
        this.trigger.local_only = true;
      }
      if (this.trigger.webhook_id === DEFAULT_WEBHOOK_ID) {
        this.trigger.webhook_id = this._generateWebhookId();
      }
    }
  }

  protected render() {
    const {
      allowed_methods: allowedMethods,
      local_only: localOnly,
      webhook_id: webhookId,
    } = this.trigger;

    return html`
      <div class="flex">
        <ha-textfield
          name="webhook_id"
          .label=${this.hass.localize(
            "ui.panel.config.automation.editor.triggers.type.webhook.webhook_id"
          )}
          .helper=${this.hass.localize(
            "ui.panel.config.automation.editor.triggers.type.webhook.webhook_id_helper"
          )}
          .disabled=${this.disabled}
          iconTrailing
          .value=${webhookId || ""}
          @input=${this._valueChanged}
        >
          <ha-icon-button
            @click=${this._copyUrl}
            slot="trailingIcon"
            .label=${this.hass.localize(
              "ui.panel.config.automation.editor.triggers.type.webhook.copy_url"
            )}
            .path=${mdiContentCopy}
          ></ha-icon-button>
        </ha-textfield>
        <ha-button-menu multi>
          <ha-icon-button
            slot="trigger"
            .label=${this.hass!.localize(
              "ui.panel.config.automation.editor.triggers.type.webhook.webhook_settings"
            )}
            .path=${mdiCog}
          ></ha-icon-button>
          ${SUPPORTED_METHODS.map(
            (method) => html`
              <ha-check-list-item
                left
                value=${method}
                @request-selected=${this._allowedMethodsChanged}
                .selected=${allowedMethods!.includes(method)}
                >${method}</ha-check-list-item
              >
            `
          )}
          <ha-check-list-item
            left
            @request-selected=${this._localOnlyChanged}
            .selected=${localOnly!}
          >
            ${this.hass!.localize(
              "ui.panel.config.automation.editor.triggers.type.webhook.local_only"
            )}
          </ha-check-list-item>
        </ha-button-menu>
      </div>
    `;
  }

  private _valueChanged(ev: CustomEvent): void {
    handleChangeEvent(this, ev);
  }

  private _localOnlyChanged(ev: CustomEvent<RequestSelectedDetail>): void {
    const newTrigger = {
      ...this.trigger,
      local_only: ev.detail.selected,
    };
    fireEvent(this, "value-changed", { value: newTrigger });
  }

  private _allowedMethodsChanged(ev: CustomEvent<RequestSelectedDetail>): void {
    const method = (ev.target as any).value;
    const selected = ev.detail.selected;
    const methods = this.trigger.allowed_methods ?? [];
    const newMethods = [...methods];

    if (selected === methods.includes(method)) {
      return;
    }

    if (selected) {
      newMethods.push(method);
    } else {
      newMethods.splice(newMethods.indexOf(method), 1);
    }
    const newTrigger = { ...this.trigger, allowed_methods: newMethods };
    fireEvent(this, "value-changed", { value: newTrigger });
  }

  private async _copyUrl(ev): Promise<void> {
    const inputElement = ev.target.parentElement as HaTextField;
    const url = this.hass.hassUrl(`/api/webhook/${inputElement.value}`);

    await copyToClipboard(url);
    showToast(this, {
      message: this.hass.localize("ui.common.copied_clipboard"),
    });
  }

  private _selectedPath(value?: boolean): string {
    return value ? mdiCheckboxMarkedOutline : mdiCheckboxBlankOutline;
  }

  static styles = css`
    .flex {
      display: flex;
    }

    ha-textfield {
      flex: 1;
    }

    ha-textfield > ha-icon-button {
      --mdc-icon-button-size: 24px;
      --mdc-icon-size: 18px;
    }

    ha-button-menu {
      padding-top: 4px;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-automation-trigger-webhook": HaWebhookTrigger;
  }
}
