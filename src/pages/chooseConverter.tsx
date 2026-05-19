import Elysia, { t } from "elysia";
import { getPossibleTargets } from "../converters/main";
import { CATEGORY_ORDER, groupByCategory } from "../helpers/categories";
import { userService } from "./user";

export const chooseConverter = new Elysia().use(userService).post(
  "/conversions",
  ({ body }) => {
    const byConverter = getPossibleTargets(body.fileType);
    const byCategory = groupByCategory(byConverter);

    return (
      <>
        {/* === Classic view: grouped by converter tool === */}
        <article
          class={`
            convert_to_popup convert-classic-view absolute z-2 m-0 hidden h-[50vh]
            max-h-[50vh] w-full flex-col overflow-x-hidden overflow-y-auto rounded-sm
            bg-neutral-800
            sm:h-[30vh]
          `}
        >
          {Object.entries(byConverter).map(([converter, targets]) => (
            <article
              class={`convert_to_group flex w-full flex-col border-b border-neutral-700 p-4`}
              data-converter={converter}
            >
              <header class="mb-2 w-full text-xl font-bold" safe>
                {converter}
              </header>
              <ul class="convert_to_target flex flex-row flex-wrap gap-1">
                {targets.map((target) => (
                  <button
                    tabindex={0}
                    class={`
                      target rounded-sm bg-neutral-700 p-1 text-base
                      hover:bg-neutral-600
                    `}
                    data-value={`${target},${converter}`}
                    data-target={target}
                    data-converter={converter}
                    type="button"
                    safe
                  >
                    {target}
                  </button>
                ))}
              </ul>
            </article>
          ))}
        </article>

        {/* === New view: grouped by category (Image/Video/Audio/…)
            Only renders categories that actually have valid targets for the input. */}
        <article
          class={`
            convert_to_popup convert-new-view absolute z-2 m-0 hidden h-[50vh]
            max-h-[50vh] w-full flex-col overflow-x-hidden overflow-y-auto rounded-sm
            bg-neutral-800
            sm:h-[40vh]
          `}
        >
          {CATEGORY_ORDER.map((cat) => {
            const items = byCategory[cat];
            if (!items || items.length === 0) return null;
            return (
              <article
                class={`category-group convert_to_group flex w-full flex-col border-b border-neutral-700`}
                data-category={cat}
              >
                <header class="mb-2 w-full" safe>
                  {cat}
                </header>
                <ul class="convert_to_target flex flex-row flex-wrap gap-1">
                  {items.map(({ target, converter }) => (
                    <button
                      tabindex={0}
                      class={`
                        target category-target rounded-sm bg-neutral-700
                        hover:bg-neutral-600
                      `}
                      data-value={`${target},${converter}`}
                      data-target={target}
                      data-converter={converter}
                      type="button"
                      safe
                    >
                      {target}
                    </button>
                  ))}
                </ul>
              </article>
            );
          })}
        </article>

        <select name="convert_to" aria-label="Convert to" required hidden>
          <option selected disabled value="">
            Convert to
          </option>
          {Object.entries(byConverter).map(([converter, targets]) => (
            <optgroup label={converter}>
              {targets.map((target) => (
                <option value={`${target},${converter}`} safe>
                  {target}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </>
    );
  },
  { body: t.Object({ fileType: t.String() }) },
);
