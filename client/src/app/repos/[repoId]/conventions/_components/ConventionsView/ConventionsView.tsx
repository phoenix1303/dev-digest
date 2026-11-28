/* Conventions view — /repos/:repoId/conventions. Run/Re-scan extraction
   (POST /repos/:id/conventions/extract), review candidates (accept / reject /
   edit), and merge the accepted ones into one skill via the modal. */
"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, EmptyState, ErrorState, Skeleton } from "@devdigest/ui";
import { AppShell } from "@/components/app-shell";
import { PageContainer } from "@/components/page-shell";
import { RepoNotFound } from "@/components/repo-not-found";
import { useConventions, useExtractConventions, useUpdateConvention } from "@/lib/hooks/conventions";
import { useActiveRepo, useRepoNotFound } from "@/lib/repo-context";
import { ApiError } from "@/lib/api";
import { ConventionCard } from "../ConventionCard";
import { CreateConventionSkillModal } from "../CreateConventionSkillModal";
import { s } from "./styles";

const SKELETON_CARDS = 3;

export function ConventionsView() {
  const t = useTranslations("conventions");
  const { repoId } = useParams<{ repoId: string }>();
  const { activeRepo } = useActiveRepo();
  const repoNotFound = useRepoNotFound(repoId);
  const { data: candidates, isLoading, isError, refetch } = useConventions(repoId);
  const extract = useExtractConventions(repoId);
  const update = useUpdateConvention(repoId);
  const [modalOpen, setModalOpen] = React.useState(false);

  const repoName = activeRepo?.full_name ?? t("page.repoFallback");
  const crumb = [
    { label: t("page.crumbLab") },
    { label: t("page.crumbConventions") },
  ];

  if (repoNotFound) {
    return (
      <AppShell crumb={crumb}>
        <RepoNotFound />
      </AppShell>
    );
  }

  const list = candidates ?? [];
  const acceptedCount = list.filter((c) => c.status === "accepted").length;
  const scanning = extract.isPending;
  const runExtraction = () => extract.mutate();

  const title = (
    <>
      {t("page.headingPrefix")}
      <span className="mono" style={s.repo}>
        {activeRepo?.name ?? repoName}
      </span>
    </>
  );
  const subtitle = list.length > 0 ? t("page.candidateCount", { count: list.length }) : t("page.subtitle");
  const actions =
    list.length > 0 ? (
      <>
        <Button kind="secondary" icon="RefreshCw" onClick={runExtraction} loading={scanning}>
          {scanning ? t("page.scanning") : t("page.rescan")}
        </Button>
        <Button kind="primary" icon="Sparkles" disabled={acceptedCount === 0} onClick={() => setModalOpen(true)}>
          {t("page.createSkill")}
        </Button>
      </>
    ) : null;

  return (
    <AppShell crumb={crumb}>
      <PageContainer title={title} subtitle={subtitle} actions={actions}>
        <div style={s.wrap}>
          {extract.error instanceof ApiError && (
            <div role="alert" style={s.error}>
              {t("page.extractionFailed")}: {extract.error.message}
            </div>
          )}

          {isLoading ? (
            <div style={s.skeletons}>
              {Array.from({ length: SKELETON_CARDS }, (_, i) => (
                <Skeleton key={i} height={140} />
              ))}
            </div>
          ) : isError ? (
            <ErrorState title={t("page.loadError")} onRetry={() => refetch()} />
          ) : list.length === 0 ? (
            <EmptyState
              icon="ListChecks"
              title={t("page.empty.title")}
              body={t("page.empty.body")}
              cta={scanning ? t("page.scanning") : t("page.empty.cta")}
              onCta={runExtraction}
              ctaLoading={scanning}
            />
          ) : (
            <>
              <div style={s.toolbar}>
                <span className="tnum">{t("page.acceptedCount", { accepted: acceptedCount, total: list.length })}</span>
              </div>
              <div style={s.list}>
                {list.map((c) => (
                  <ConventionCard
                    key={c.id}
                    candidate={c}
                    pending={update.isPending && update.variables?.id === c.id}
                    onStatus={(status) => update.mutate({ id: c.id, patch: { status } })}
                    onRule={(rule) => update.mutate({ id: c.id, patch: { rule } })}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </PageContainer>

      {modalOpen && (
        <CreateConventionSkillModal
          repoId={repoId}
          repoName={repoName}
          candidates={list}
          onClose={() => setModalOpen(false)}
        />
      )}
    </AppShell>
  );
}
