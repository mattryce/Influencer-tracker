"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { ActionForm, Field, FormMessage, SubmitButton } from "@/components/app/form-bits";
import { initialFormState, type FormState } from "@/lib/forms";
import { formatDeliverables } from "@/lib/deals/deliverables";
import type { Campaign, Deal } from "@/lib/types";
import { createCampaign, createDeal, deleteDeal, updateCampaign, updateDeal } from "./actions";

function CampaignFields({ campaign, brands, errors }: { campaign?: Campaign; brands?: Array<{ id: string; name: string }>; errors?: Record<string, string> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {brands ? (
        <Field label="Brand" htmlFor="brand_id" error={errors?.brand_id}>
          <NativeSelect id="brand_id" name="brand_id" required defaultValue={brands.length === 1 ? brands[0].id : ""}>
            <option value="" disabled>
              Choose a brand…
            </option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      ) : (
        <input type="hidden" name="brand_id" value={campaign?.brand_id} />
      )}
      <Field label="Campaign name" htmlFor="name" error={errors?.name}>
        <Input id="name" name="name" required defaultValue={campaign?.name} />
      </Field>
      <Field label="Status" htmlFor="status">
        <NativeSelect id="status" name="status" defaultValue={campaign?.status ?? "draft"}>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </NativeSelect>
      </Field>
      <Field label="Budget (USD)" htmlFor="budget" error={errors?.budget}>
        <Input id="budget" name="budget" inputMode="decimal" defaultValue={campaign?.budget ?? ""} placeholder="5000" />
      </Field>
      <Field label="Start date" htmlFor="starts_on" error={errors?.starts_on}>
        <Input id="starts_on" name="starts_on" type="date" defaultValue={campaign?.starts_on ?? ""} />
      </Field>
      <Field label="End date" htmlFor="ends_on" error={errors?.ends_on}>
        <Input id="ends_on" name="ends_on" type="date" defaultValue={campaign?.ends_on ?? ""} />
      </Field>
      <Field label="Required hashtags" htmlFor="required_hashtags" hint="Used to match posts to this campaign, e.g. #hotshotsecret #ad">
        <Input id="required_hashtags" name="required_hashtags" defaultValue={campaign?.required_hashtags.map((t) => `#${t}`).join(" ")} />
      </Field>
      <Field label="Required @mentions" htmlFor="required_mentions" hint="e.g. @hotshotsecret">
        <Input id="required_mentions" name="required_mentions" defaultValue={campaign?.required_mentions.map((t) => `@${t}`).join(" ")} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Goal" htmlFor="goal">
          <Textarea id="goal" name="goal" defaultValue={campaign?.goal ?? ""} placeholder="What does success look like?" />
        </Field>
      </div>
    </div>
  );
}

export function NewCampaignForm({ brands }: { brands: Array<{ id: string; name: string }> }) {
  const [state, action, actionPending] = useActionState(createCampaign, initialFormState);
  return (
    <ActionForm action={action} pending={actionPending} className="space-y-4">
      <CampaignFields brands={brands} errors={state.fieldErrors} />
      <FormMessage state={state} />
      <SubmitButton pendingText="Creating…">Create campaign</SubmitButton>
    </ActionForm>
  );
}

export function EditCampaignForm({ campaign, canEdit }: { campaign: Campaign; canEdit: boolean }) {
  const [state, action, actionPending] = useActionState(updateCampaign.bind(null, campaign.id), initialFormState);
  return (
    <ActionForm action={action} pending={actionPending} className="space-y-4">
      <fieldset disabled={!canEdit}>
        <CampaignFields campaign={campaign} errors={state.fieldErrors} />
      </fieldset>
      <FormMessage state={state} />
      {canEdit && <SubmitButton>Save campaign</SubmitButton>}
    </ActionForm>
  );
}

type CreatorOption = { id: string; name: string; handle: string | null };

function DealFields({
  deal,
  creators,
  errors,
  shopifyConnected,
}: {
  deal?: Deal;
  creators?: CreatorOption[];
  errors?: Record<string, string>;
  shopifyConnected: boolean;
}) {
  const [utm, setUtm] = useState(deal?.utm_tag ?? "");
  const [autoDiscount, setAutoDiscount] = useState(deal?.create_shopify_discount ?? false);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {creators ? (
        <Field label="Creator" htmlFor="creator_id" error={errors?.creator_id}>
          <NativeSelect
            id="creator_id"
            name="creator_id"
            required
            defaultValue=""
            onChange={(e) => {
              const c = creators.find((x) => x.id === e.target.value);
              if (c?.handle && !utm) setUtm(c.handle.replace(/[^a-z0-9_-]/g, ""));
            }}
          >
            <option value="" disabled>
              Choose a creator…
            </option>
            {creators.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.handle ? ` (@${c.handle})` : ""}
              </option>
            ))}
          </NativeSelect>
        </Field>
      ) : (
        <input type="hidden" name="creator_id" value={deal?.creator_id} />
      )}
      <Field label="Status" htmlFor="status">
        <NativeSelect id="status" name="status" defaultValue={deal?.status ?? "active"}>
          <option value="proposed">Proposed</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </NativeSelect>
      </Field>
      <Field label="Fee paid (USD)" htmlFor="fee" error={errors?.fee}>
        <Input id="fee" name="fee" inputMode="decimal" defaultValue={deal?.fee ?? ""} placeholder="750" />
      </Field>
      <Field label="Product value sent (USD)" htmlFor="product_value" error={errors?.product_value}>
        <Input id="product_value" name="product_value" inputMode="decimal" defaultValue={deal?.product_value ?? ""} placeholder="120" />
      </Field>
      <Field label="Deliverables" htmlFor="deliverables" error={errors?.deliverables} hint='e.g. "2 Reels + 3 Stories" or "1 TikTok, 1 YouTube video"'>
        <Input id="deliverables" name="deliverables" defaultValue={formatDeliverables(deal?.deliverables)} />
      </Field>
      <Field label="Due date" htmlFor="due_date" error={errors?.due_date}>
        <Input id="due_date" name="due_date" type="date" defaultValue={deal?.due_date ?? ""} />
      </Field>
      <Field label="Discount code" htmlFor="discount_code" error={errors?.discount_code} hint="Orders using this code are credited to this deal.">
        <Input id="discount_code" name="discount_code" defaultValue={deal?.discount_code ?? ""} className="font-mono uppercase" placeholder="JAKE15" />
      </Field>
      <Field label="UTM tag" htmlFor="utm_tag" error={errors?.utm_tag} hint="Put this in the creator's link (e.g. ?utm_content=jaketorque). Orders from those links are credited to this deal.">
        <Input id="utm_tag" name="utm_tag" value={utm} onChange={(e) => setUtm(e.target.value)} className="font-mono" placeholder="jaketorque" />
      </Field>
      <div className="space-y-2 sm:col-span-2">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="create_shopify_discount" className="mt-0.5 size-4" checked={autoDiscount} onChange={(e) => setAutoDiscount(e.target.checked)} />
          <span>
            Create this discount code in Shopify automatically
            {!shopifyConnected && autoDiscount && (
              <span className="block text-xs text-amber-700 dark:text-amber-400">
                This brand&apos;s Shopify store isn&apos;t connected yet. The code will be created as soon as it is — until then it won&apos;t
                work at checkout.
              </span>
            )}
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="usage_rights" className="size-4" defaultChecked={deal?.usage_rights} />
          We have usage rights to reuse this creator&apos;s content
        </label>
      </div>
      <div className="sm:col-span-2">
        <Field label="Notes" htmlFor="notes">
          <Textarea id="notes" name="notes" defaultValue={deal?.notes ?? ""} />
        </Field>
      </div>
    </div>
  );
}

export function NewDealForm({ campaignId, creators, shopifyConnected }: { campaignId: string; creators: CreatorOption[]; shopifyConnected: boolean }) {
  const [state, action, actionPending] = useActionState<FormState, FormData>(createDeal.bind(null, campaignId), initialFormState);
  // Remount the fields after a successful add so the form clears.
  const [formKey, setFormKey] = useState(0);
  const [seen, setSeen] = useState<FormState>(state);
  if (state !== seen) {
    setSeen(state);
    if (state.ok) setFormKey((k) => k + 1);
  }
  if (creators.length === 0) {
    return <p className="text-sm text-muted-foreground">Every creator is already in this campaign, or there are no creators yet.</p>;
  }
  return (
    <ActionForm action={action} pending={actionPending} className="space-y-4" key={formKey}>
      <DealFields creators={creators} errors={state.fieldErrors} shopifyConnected={shopifyConnected} />
      <FormMessage state={state} />
      <SubmitButton pendingText="Adding…">Add deal</SubmitButton>
    </ActionForm>
  );
}

export function EditDealForm({ campaignId, deal, canEdit, shopifyConnected }: { campaignId: string; deal: Deal; canEdit: boolean; shopifyConnected: boolean }) {
  const [state, action, actionPending] = useActionState(updateDeal.bind(null, campaignId, deal.id), initialFormState);
  const [pending, start] = useTransition();
  return (
    <ActionForm action={action} pending={actionPending} className="space-y-4">
      <fieldset disabled={!canEdit}>
        <DealFields deal={deal} errors={state.fieldErrors} shopifyConnected={shopifyConnected} />
      </fieldset>
      <FormMessage state={state} />
      {canEdit && (
        <div className="flex justify-between gap-2">
          <SubmitButton>Save deal</SubmitButton>
          <Button
            type="button"
            variant="ghost"
            className="text-red-700"
            disabled={pending}
            onClick={() => confirm("Delete this deal? This can't be undone.") && start(() => deleteDeal(campaignId, deal.id))}
          >
            Delete deal
          </Button>
        </div>
      )}
    </ActionForm>
  );
}
