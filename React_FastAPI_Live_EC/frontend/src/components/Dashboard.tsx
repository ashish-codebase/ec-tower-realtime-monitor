import { useState, useEffect, useCallback } from "react";
import type { Site, TowerDataPoint, SensorGroup } from "../types";
import { getSensorGroups as apiGetSensorGroups } from "../api";
import { getSiteData, triggerFetch, getFetchStatus, clearCache } from "../api";
import SiteSelector from "./SiteSelector";
import TimeSeriesChart from "./TimeSeriesChart";
import WindRoseChart from "./WindRoseChart";
import StatsTable from "./StatsTable";
import DataTable from "./DataTable";
import ErrorBanner from "./ErrorBanner";
import ThemeToggle from "./ThemeToggle";

interface Props {
	backendUrl?: string;
}

export default function Dashboard({ backendUrl: _backendUrl }: Props) {
	const [sites, setSites] = useState<Site[]>([]);
	const [selectedIp, setSelectedIp] = useState<string>("");
	const [data, setData] = useState<TowerDataPoint[]>([]);
	const [sensorGroups, setSensorGroups] = useState<SensorGroup[]>([]);
	const [loading, setLoading] = useState(false);
	const [fetching, setFetching] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [siteStatuses, setSiteStatuses] = useState<
		Record<string, "live" | "no-data" | "not-found" | "checking">
	>({});
	const [activeTab, setActiveTab] = useState<"charts" | "stats" | "table">(
		"charts",
	);

	const selectedSite = sites.find((s) => s.ip === selectedIp);
	const siteName = selectedSite ? selectedSite.name : "";

	// Load sites on mount
	useEffect(() => {
		fetch("/api/sites")
			.then((res) => res.json())
			.then(setSites)
			.catch((err: any) =>
				setError(`Failed to load site config: ${err.message}`),
			);

		apiGetSensorGroups()
			.then((sg) => setSensorGroups(sg.sensorGroups))
			.catch((err: any) =>
				setError(`Failed to load sensor groups: ${err.message}`),
			);
	}, []);

	// Load data when site changes
	const loadData = useCallback(async (ip: string) => {
		if (!ip) return;
		setLoading(true);
		setError(null);
		try {
			const result = await getSiteData(ip, false);
			setData(result);
			setSiteStatuses((prev) => ({
				...prev,
				[ip]: result.length > 0 ? "live" : "no-data",
			}));
		} catch (err: any) {
			setError(`Failed to load data: ${err.message}`);
			setSiteStatuses((prev) => ({ ...prev, [ip]: "not-found" }));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadData(selectedIp);
	}, [selectedIp, loadData]);

	// Poll fetch status
	useEffect(() => {
		if (!fetching) return;
		const interval = setInterval(async () => {
			try {
				const status = await getFetchStatus();
				if (!status.in_progress) setFetching(false);
			} catch {
				/* ignore */
			}
		}, 2000);
		return () => clearInterval(interval);
	}, [fetching]);

	const handleFetch = async () => {
		setFetching(true);
		setError(null);
		try {
			await Promise.race([
				triggerFetch(),
				new Promise((_, reject) =>
					setTimeout(
						() => reject(new Error("Fetch trigger timed out")),
						180000,
					),
				),
			]);
		} catch (err: any) {
			setError(`Fetch failed: ${err.message}`);
			setFetching(false);
		}
	};

	const handleClearCache = async () => {
		try {
			await clearCache(selectedIp || undefined);
			setData([]);
			setSiteStatuses({});
			if (selectedIp) {
				setSiteStatuses((prev) => ({ ...prev, [selectedIp]: "no-data" }));
			}
		} catch (err: any) {
			setError(`Clear failed: ${err.message}`);
		}
	};

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
			<div className="flex flex-col md:flex-row">
				{/* Sidebar */}
				<aside className="w-full md:w-64 bg-white dark:bg-gray-800 shadow-md p-4 md:min-h-screen">
					<h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">
						Controls
					</h2>

					{/* Controls */}
					<div className="flex flex-col gap-3 mb-6">
						<button
							onClick={handleFetch}
							disabled={fetching || loading}
							className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
						>
							{fetching ? "Fetching..." : "🔄 Fetch Now"}
						</button>
						<button
							onClick={handleClearCache}
							disabled={loading}
							className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition"
						>
							🗑 Clear Cache
						</button>
					</div>

					{/* Site Selector */}
					<SiteSelector
						sites={sites}
						selected={selectedIp}
						onChange={setSelectedIp}
						siteStatuses={siteStatuses}
					/>
				</aside>

				{/* Main Content */}
				<main className="flex-1 p-4 sm:p-6">
					{/* Header */}
					<div className="flex justify-between items-center mb-6">
						<div>
							<h1 className="text-2xl font-bold">EC Tower Live Monitor</h1>
							<p className="text-sm text-gray-500 dark:text-gray-400">
								Real-time eddy covariance data dashboard
							</p>
						</div>
						<ThemeToggle />
					</div>

					<ErrorBanner message={error} onClose={() => setError(null)} />

					{/* Loading indicator */}
					{loading && (
						<div className="text-center py-4 text-gray-500">
							Loading data...
						</div>
					)}

					{/* Tab navigation */}
					{!loading && (
						<>
							<div className="flex gap-2 mb-4 border-b border-gray-300 dark:border-gray-600">
								{(["charts", "stats", "table"] as const).map((tab) => (
									<button
										key={tab}
										onClick={() => setActiveTab(tab)}
										className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${activeTab === tab ? "bg-white dark:bg-gray-800 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
									>
										{tab === "charts"
											? "📊 Charts"
											: tab === "stats"
												? "📋 Statistics"
												: "📄 Data Table"}
									</button>
								))}
							</div>

							{/* Content */}
							<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
								{activeTab === "charts" && (
									<>
										{/* Time series charts by sensor group */}
										{sensorGroups.map((group) => (
											<div
												key={group.name}
												className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"
											>
												<TimeSeriesChart
													data={data}
													sensorKeys={group.keys}
													siteName={siteName}
													title={group.name}
												/>
											</div>
										))}

										{/* Wind Rose */}
										<div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
											<WindRoseChart data={data} siteName={siteName} />
										</div>
									</>
								)}

								{activeTab === "stats" && (
									<div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
										<StatsTable data={data} sensorGroups={sensorGroups} />
									</div>
								)}

								{activeTab === "table" && (
									<div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
										<DataTable data={data} />
									</div>
								)}
							</div>
						</>
					)}
				</main>
			</div>
		</div>
	);
}
