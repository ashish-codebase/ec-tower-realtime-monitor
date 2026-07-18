// Column Registry - collects all unique columns from all towers
// Each tower may have different columns, missing columns get NaN

export class ColumnRegistry {
  private columns: Set<string> = new Set(['SECONDS', 'NANOSECONDS']);
  private towerColumns: Map<string, Set<string>> = new Map(); // site -> columns
  
  // Add columns from a single tower
  addTowerColumns(siteName: string, columns: string[]): void {
    const siteCols = new Set(columns);
    this.towerColumns.set(siteName, siteCols);
    
    // Merge into global registry
    for (const col of columns) {
      this.columns.add(col);
    }
  }
  
  // Get all unique columns across all towers
  getAllColumns(): string[] {
    return Array.from(this.columns).sort();
  }
  
  // Get columns for a specific tower
  getTowerColumns(siteName: string): string[] {
    return Array.from(this.towerColumns.get(siteName) || []);
  }
  
  // Check if a column exists for a specific tower
  hasColumn(siteName: string, columnName: string): boolean {
    return this.towerColumns.get(siteName)?.has(columnName) || false;
  }
  
  // Get the registry as a JSON-serializable object
  toJSON(): { allColumns: string[]; towerColumns: Record<string, string[]> } {
    const towerCols: Record<string, string[]> = {};
    for (const [site, cols] of this.towerColumns) {
      towerCols[site] = Array.from(cols);
    }
    
    return {
      allColumns: this.getAllColumns(),
      towerColumns: towerCols,
    };
  }
  
  // Load from JSON
  static fromJSON(data: { allColumns: string[]; towerColumns: Record<string, string[]> }): ColumnRegistry {
    const registry = new ColumnRegistry();
    for (const col of data.allColumns) {
      registry.columns.add(col);
    }
    for (const [site, cols] of Object.entries(data.towerColumns)) {
      registry.towerColumns.set(site, new Set(cols));
    }
    return registry;
  }
}

// Singleton instance
export const columnRegistry = new ColumnRegistry();

// Get comprehensive list of all possible DAQM columns
export function getAllDaqmColumns(): string[] {
  return columnRegistry.getAllColumns();
}

// Check if a site has a specific column
export function siteHasColumn(siteName: string, columnName: string): boolean {
  return columnRegistry.hasColumn(siteName, columnName);
}
