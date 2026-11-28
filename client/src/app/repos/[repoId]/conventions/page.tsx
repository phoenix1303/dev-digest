import { ConventionsView } from "./_components/ConventionsView";

/* Route: /repos/:repoId/conventions (Conventions Extractor). Thin route entry —
   the view, cards and the create-skill modal live in _components. */
export default function ConventionsPage() {
  return <ConventionsView />;
}
