"""Column Registry — tracks all unique columns from all towers."""


class ColumnRegistry:
    def __init__(self):
        self._columns: set[str] = {"SECONDS", "NANOSECONDS"}
        self._tower_columns: dict[str, set[str]] = {}

    def add_tower_columns(self, site_name: str, columns: list[str]):
        site_cols = set(columns)
        self._tower_columns[site_name] = site_cols
        for col in columns:
            self._columns.add(col)

    def get_all_columns(self) -> list[str]:
        return sorted(self._columns)

    def get_tower_columns(self, site_name: str) -> list[str]:
        return sorted(self._tower_columns.get(site_name, []))

    def has_column(self, site_name: str, column_name: str) -> bool:
        return column_name in self._tower_columns.get(site_name, set())

    def to_dict(self) -> dict:
        return {
            "allColumns": self.get_all_columns(),
            "towerColumns": {site: sorted(cols) for site, cols in self._tower_columns.items()},
        }

    @staticmethod
    def from_dict(data: dict) -> "ColumnRegistry":
        registry = ColumnRegistry()
        for col in data.get("allColumns", []):
            registry._columns.add(col)
        for site, cols in data.get("towerColumns", {}).items():
            registry._tower_columns[site] = set(cols)
        return registry


# Singleton instance
column_registry = ColumnRegistry()
