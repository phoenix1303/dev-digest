/* hooks/conventions.ts — React Query hooks for the Conventions Extractor
   (L02): list/extract candidates, accept/reject/edit one, save the merged
   skill. Components never call `api` directly. */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./keys";
import { api } from "../api";
import type {
  ConventionCandidate,
  CreateConventionSkillInput,
  ExtractConventionsResult,
  Skill,
  UpdateConventionInput,
} from "@devdigest/shared";

export function useConventions(repoId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.conventions(repoId),
    queryFn: () => api.get<ConventionCandidate[]>(`/repos/${repoId}/conventions`),
    enabled: !!repoId,
  });
}

/** Run / re-run extraction (one LLM call server-side); replaces the cached list. */
export function useExtractConventions(repoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<ExtractConventionsResult>(`/repos/${repoId}/conventions/extract`),
    onSuccess: (res) => qc.setQueryData(queryKeys.conventions(repoId), res.candidates),
  });
}

/** Accept / reject / edit one candidate; patches it in the cached list. */
export function useUpdateConvention(repoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateConventionInput }) =>
      api.patch<ConventionCandidate>(`/conventions/${id}`, patch),
    onSuccess: (updated) =>
      qc.setQueryData<ConventionCandidate[]>(queryKeys.conventions(repoId), (prev) =>
        prev?.map((c) => (c.id === updated.id ? updated : c)),
      ),
  });
}

/** Save the merged draft as a skill (type convention, source extracted). */
export function useCreateConventionSkill(repoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateConventionSkillInput) =>
      api.post<Skill>(`/repos/${repoId}/conventions/skill`, input),
    onSuccess: (skill) => {
      qc.invalidateQueries({ queryKey: queryKeys.skills() });
      qc.setQueryData(queryKeys.skill(skill.id), skill);
    },
  });
}
