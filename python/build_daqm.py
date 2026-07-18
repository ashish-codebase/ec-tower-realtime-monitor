import pandas as pd
from datetime import timedelta


def parse_ec_data(rows):
    """
    Parse eddy covariance tower data rows into sonic and daqm DataFrames.
    
    Parameters:
    -----------
    rows : list of lists
        Tab-separated CSV rows from csv.reader (each row is a list of strings)
    
    Returns:
    --------
    tuple : (sonic_resampled, daqm)
        sonic_resampled: DataFrame with resampled sonic data (1-minute intervals)
        daqm: DataFrame with DAQM mean flux data
    """
    # ── SONIC ──────────────────────────────────────────────
    sonic_header = None
    sonic_rows = []

    for row in rows:
        if not row:
            continue
        rtype = row[0]
        if rtype == 'DATASONICH':
            sonic_header = row[1:]
        elif rtype == 'DATASONIC':
            sonic_rows.append(row[1:])

    sonic = pd.DataFrame(sonic_rows, columns=sonic_header)
    for col in ['SECONDS', 'NANOSECONDS', 'DIAG', 'U', 'V', 'W', 'SOS', 'TEMP', 'AIN1', 'AIN2', 'AIN3', 'AIN4', 'CHK']:
        sonic[col] = pd.to_numeric(sonic[col], errors='coerce')

    # ── Resample to 1-minute intervals ─────────────────────
    sonic['datetime'] = pd.to_datetime(sonic['SECONDS'], unit='s') + pd.to_timedelta(sonic['NANOSECONDS'], unit='ns')
    sonic = sonic.set_index('datetime')

    sonic_resampled = sonic.resample('1min').mean()
    sonic_resampled = sonic_resampled.reset_index()
    sonic_resampled = sonic_resampled.drop(columns=['SECONDS', 'NANOSECONDS'])

    # ── DAQM ───────────────────────────────────────────────
    daqm_header = None
    daqm_rows = []

    for row in rows:
        if not row:
            continue
        rtype = row[0]
        if rtype == 'DATADAQMH':
            daqm_header = row[1:]
        elif rtype == 'DATADAQM':
            daqm_rows.append(row[1:])

    daqm = pd.DataFrame(daqm_rows, columns=daqm_header)

    numeric_cols = ['SECONDS', 'NANOSECONDS', 'Relay_1_1_1', 'Relay_2_1_1', 'Relay_3_1_1',
                'SWC_1_1_1', 'TS_1_1_1', 'SWC_2_1_1', 'TS_2_1_1', 'SWC_3_1_1', 'TS_3_1_1',
                'SWC_4_1_1', 'TS_4_1_1', 'SWC_5_1_1', 'TS_5_1_1', 'SWC_6_1_1', 'TS_6_1_1',
                'TC_1_1_1', 'TSENSOR_1_1_1', 'SHFSENS_1_1_1', 'SHF_1_1_1',
                'SHFSENS_2_1_1', 'SHF_2_1_1', 'SHFSENS_3_1_1', 'SHF_3_1_1',
                'SWIN_1_1_1', 'SWOUT_1_1_1', 'LWIN_1_1_1', 'LWOUT_1_1_1',
                'TCNR4_C_1_1_1', 'RN_1_1_1', 'ALB_1_1_1', 'TA_1_1_1', 'RH_1_1_1',
                'PPFD_1_1_1', 'P_RAIN_1_1_1', 'DAQM_V_1_1_1', 'DAQM_T_1_1_1',
                'TS_7_1_1', 'TS_8_1_1', 'TS_9_1_1', 'DRM_POWER_STATUS_1_1_1',
                'DRM_V_BATTERY_1_1_1', 'DRM_V_MAIN_1_1_1', 'CHK']
    for col in numeric_cols:
        daqm[col] = pd.to_numeric(daqm[col], errors='coerce')

    # ── Convert DAQM timestamps ─────────────────────────────
    daqm['datetime'] = pd.to_datetime(daqm['SECONDS'], unit='s') + pd.to_timedelta(daqm['NANOSECONDS'], unit='ns')
    daqm = daqm.set_index('datetime')
    daqm = daqm.reset_index()
    daqm = daqm.drop(columns=['SECONDS', 'NANOSECONDS'])

    return sonic_resampled, daqm


# ── Main execution (optional) ─────────────────────────────
if __name__ == '__main__':
    import csv
    
    with open('D:/StreamlitProjects/EC_Tower_RealTime/SonicData_clipped.csv', 'r') as f:
        reader = csv.reader(f, delimiter='\t')
        rows = list(reader)

    sonic_resampled, daqm = parse_ec_data(rows)

    # Display
    print("=" * 70)
    print("SONIC DataFrame (Resampled to 1-minute)")
    print("=" * 70)
    print(f"Shape: {sonic_resampled.shape}")
    print(sonic_resampled.head(5).to_string())

    print("\n" + "=" * 70)
    print("DAQM DataFrame")
    print("=" * 70)
    print(f"Shape: {daqm.shape}")
    print(daqm.to_string())

    # Save to CSV
    sonic_resampled.to_csv('sonic.csv', index=False)
    print(f"\nSaved: sonic.csv ({len(sonic_resampled)} rows)")

    daqm.to_csv('daqm.csv', index=False)
    print(f"Saved: daqm.csv ({len(daqm)} rows)")
