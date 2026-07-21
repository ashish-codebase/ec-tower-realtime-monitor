import type { Site } from "../types";

interface Props {
	sites: Site[];
	selected: string;
	onChange: (ip: string) => void;
	siteStatuses?: Record<string, "live" | "no-data" | "not-found" | "checking">;
}

export default function SiteSelector({
	sites,
	selected,
	onChange,
	siteStatuses,
}: Props) {
	return (
		<div className="flex flex-wrap gap-3 mb-6">
			<div className="flex flex-col gap-3 mb-6">
				{sites.map((site) => {
					const isSelected = selected === site.ip;
					const status = siteStatuses?.[site.ip] || "checking";

					return (
						<button
							key={site.ip}
							type="button"
							onClick={() => onChange(site.ip)}
							disabled={
								(status === "not-found" || status === "no-data") && !isSelected
							}
							className={`
              flex items-center gap-2 px-4 py-2 rounded-lg select-none transition-all w-full justify-start
              ${
								isSelected
									? "bg-blue-600 text-white shadow-lg scale-105"
									: status === "not-found" || status === "no-data"
										? "bg-gray-200 dark:bg-gray-700 opacity-50"
										: "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
							}
            `}
						>
							<span
								className={`
                w-4 h-4 rounded-full border-2 flex-shrink-0
                ${
									isSelected
										? "border-white bg-white"
										: status === "not-found" || status === "no-data"
											? "border-red-600 bg-transparent"
											: "border-blue-500 bg-transparent"
								}
              `}
							/>
							<span className="text-lg flex-shrink-0">
								{status === "live" && "🟢"}
								{status === "no-data" && "🔴"}
								{status === "not-found" && "⚪"}
								{status === "checking" && "🔄"}
							</span>
							<span className="text-sm font-medium truncate">{site.name}</span>
						</button>
					);
				})}
			</div>
		</div>
	);
}
