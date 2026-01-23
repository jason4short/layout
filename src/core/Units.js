/**
 * Units - Unit conversion and formatting for CAD application
 * Internal unit is always millimeters (mm)
 */

const UnitType = Object.freeze({
	MM: 'mm',
	CM: 'cm',
	M: 'm',
	IN: 'in',
	FT: 'ft',
	FT_IN: 'ft-in'  // Feet and inches: 1'-6"
});

// Conversion factors TO millimeters
const TO_MM = {
	[UnitType.MM]: 1,
	[UnitType.CM]: 10,
	[UnitType.M]: 1000,
	[UnitType.IN]: 25.4,
	[UnitType.FT]: 304.8,
	[UnitType.FT_IN]: 25.4  // Base unit for parsing is inches
};

// Display precision (decimal places)
const PRECISION = {
	[UnitType.MM]: 1,
	[UnitType.CM]: 2,
	[UnitType.M]: 3,
	[UnitType.IN]: 3,
	[UnitType.FT]: 3,
	[UnitType.FT_IN]: 0  // Uses fractions, not decimals
};

// Common fractions for woodworking (inch denominators)
const FRACTIONS = [1, 2, 4, 8, 16, 32, 64];

class UnitsManager {
	constructor() {
		this.currentUnit = UnitType.MM;
		this.useFractions = true;  // For imperial, use 1/2" vs 0.5"
		this.fractionPrecision = 16;  // Snap to nearest 1/16"
		this.load();  // Load saved preference
	}

	// Save unit preference to localStorage
	save() {
		try {
			localStorage.setItem('cadc-unit', this.currentUnit);
			localStorage.setItem('cadc-useFractions', this.useFractions.toString());
		} catch (e) {
			// localStorage not available
		}
	}

	// Load unit preference from localStorage
	load() {
		try {
			const savedUnit = localStorage.getItem('cadc-unit');
			if (savedUnit && TO_MM[savedUnit] !== undefined) {
				this.currentUnit = savedUnit;
			}
			const savedFractions = localStorage.getItem('cadc-useFractions');
			if (savedFractions !== null) {
				this.useFractions = savedFractions === 'true';
			}
		} catch (e) {
			// localStorage not available
		}
	}

	// Set the display unit
	setUnit(unit) {
		if (TO_MM[unit] !== undefined) {
			this.currentUnit = unit;
			this.save();
		}
	}

	getUnit() {
		return this.currentUnit;
	}

	// Convert internal mm to display unit
	toDisplay(mm, unit = this.currentUnit) {
		return mm / TO_MM[unit];
	}

	// Convert from display unit to internal mm
	toMM(value, unit = this.currentUnit) {
		return value * TO_MM[unit];
	}

	// Format a mm value for display in current unit
	format(mm, unit = this.currentUnit, showUnit = true) {
		if (unit === UnitType.FT_IN) {
			return this.formatFeetInches(mm, showUnit);
		}

		if ((unit === UnitType.IN) && this.useFractions) {
			return this.formatFractionalInches(mm, showUnit);
		}

		const value = this.toDisplay(mm, unit);
		const precision = PRECISION[unit];
		const formatted = value.toFixed(precision).replace(/\.?0+$/, '');

		return showUnit ? `${formatted} ${unit}` : formatted;
	}

	// Format as feet and inches: 1'-6 1/2"
	formatFeetInches(mm, showUnit = true) {
		const totalInches = mm / TO_MM[UnitType.IN];
		const feet = Math.floor(totalInches / 12);
		const inches = totalInches % 12;

		let result = '';

		if (feet > 0) {
			result += `${feet}'`;
		}

		if (inches > 0 || feet === 0) {
			if (feet > 0) result += '-';
			if (this.useFractions) {
				result += this.formatFraction(inches);
			} else {
				result += inches.toFixed(2).replace(/\.?0+$/, '');
			}
			if (showUnit) result += '"';
		}

		return result;
	}

	// Format as fractional inches: 1 1/2"
	formatFractionalInches(mm, showUnit = true) {
		const inches = mm / TO_MM[UnitType.IN];
		const result = this.formatFraction(inches);
		return showUnit ? `${result}"` : result;
	}

	// Convert decimal to fraction string: 1.5 -> "1 1/2"
	formatFraction(decimal) {
		const negative = decimal < 0;
		decimal = Math.abs(decimal);

		const whole = Math.floor(decimal);
		const remainder = decimal - whole;

		if (remainder < 0.001) {
			return negative ? `-${whole}` : `${whole}`;
		}

		// Find nearest fraction
		let bestNumerator = 0;
		let bestDenominator = 1;
		let bestError = remainder;

		for (const denom of FRACTIONS) {
			if (denom > this.fractionPrecision) break;

			const numer = Math.round(remainder * denom);
			const error = Math.abs(remainder - numer / denom);

			if (error < bestError) {
				bestError = error;
				bestNumerator = numer;
				bestDenominator = denom;
			}
		}

		// Simplify fraction
		if (bestNumerator > 0) {
			const gcd = this.gcd(bestNumerator, bestDenominator);
			bestNumerator /= gcd;
			bestDenominator /= gcd;
		}

		let result = '';
		if (negative) result += '-';

		if (whole > 0) {
			result += whole;
			if (bestNumerator > 0) {
				result += ` ${bestNumerator}/${bestDenominator}`;
			}
		} else if (bestNumerator > 0) {
			result += `${bestNumerator}/${bestDenominator}`;
		} else {
			result += '0';
		}

		return result;
	}

	// Greatest common divisor for fraction simplification
	gcd(a, b) {
		return b === 0 ? a : this.gcd(b, a % b);
	}

	// Parse user input string to mm
	// Accepts: "10", ".5", "10mm", ".5mm", "1in", ".75"", "1'", "1'-6"", "1 1/2"", "1/2in"
	parse(input) {
		if (typeof input === 'number') {
			return this.toMM(input);
		}

		input = input.trim().toLowerCase();

		// Empty or invalid
		if (!input) return null;

		// Try feet-inches format: 1'-6", 1'6", 1' 6"
		const ftInMatch = input.match(/^(-?\d+)'[\s-]*(\d+(?:\s+\d+\/\d+|\.\d+|\/\d+)?)?(?:"|in)?$/);
		if (ftInMatch) {
			const feet = parseFloat(ftInMatch[1]) || 0;
			const inches = ftInMatch[2] ? this.parseFraction(ftInMatch[2]) : 0;
			return (feet * 12 + inches) * TO_MM[UnitType.IN];
		}

		// Try feet only: 1', 1ft, .5'
		const ftMatch = input.match(/^(-?(?:\d+\.?\d*|\.\d+))\s*(?:'|ft)$/);
		if (ftMatch) {
			return parseFloat(ftMatch[1]) * TO_MM[UnitType.FT];
		}

		// Try inches with fractions: 1 1/2", 1/2", 1.5", .75"
		const inMatch = input.match(/^(-?(?:\d+(?:\s+\d+\/\d+|\.?\d*)|\/\d+|\.\d+))\s*(?:"|in|inch|inches)$/);
		if (inMatch) {
			return this.parseFraction(inMatch[1]) * TO_MM[UnitType.IN];
		}

		// Try metric: 10mm, 10 mm, 10cm, 10m, .5mm
		const metricMatch = input.match(/^(-?(?:\d+\.?\d*|\.\d+))\s*(mm|cm|m)$/);
		if (metricMatch) {
			const value = parseFloat(metricMatch[1]);
			const unit = metricMatch[2];
			return value * TO_MM[unit];
		}

		// Plain number - use current unit (supports .5, 1.5, 10)
		const plainMatch = input.match(/^(-?(?:\d+\.?\d*|\.\d+))$/);
		if (plainMatch) {
			return parseFloat(plainMatch[1]) * TO_MM[this.currentUnit];
		}

		// Try fraction without unit: 1/2, 1 1/2
		const fracMatch = input.match(/^(-?\d+(?:\s+\d+\/\d+|\/\d+))$/);
		if (fracMatch) {
			return this.parseFraction(fracMatch[1]) * TO_MM[this.currentUnit];
		}

		return null;
	}

	// Parse a fraction string: "1 1/2" -> 1.5, "1/2" -> 0.5
	parseFraction(str) {
		str = str.trim();

		// Mixed number: 1 1/2
		const mixedMatch = str.match(/^(-?\d+)\s+(\d+)\/(\d+)$/);
		if (mixedMatch) {
			const whole = parseFloat(mixedMatch[1]);
			const numer = parseFloat(mixedMatch[2]);
			const denom = parseFloat(mixedMatch[3]);
			const sign = whole < 0 ? -1 : 1;
			return whole + sign * (numer / denom);
		}

		// Simple fraction: 1/2
		const fracMatch = str.match(/^(-?\d+)\/(\d+)$/);
		if (fracMatch) {
			return parseFloat(fracMatch[1]) / parseFloat(fracMatch[2]);
		}

		// Decimal or whole number
		return parseFloat(str) || 0;
	}

	// Get unit label for display
	getUnitLabel(unit = this.currentUnit) {
		switch (unit) {
			case UnitType.FT_IN: return 'ft-in';
			default: return unit;
		}
	}

	// Get available units for UI
	getAvailableUnits() {
		return [
			{ value: UnitType.MM, label: 'Millimeters (mm)' },
			{ value: UnitType.CM, label: 'Centimeters (cm)' },
			{ value: UnitType.M, label: 'Meters (m)' },
			{ value: UnitType.IN, label: 'Inches (in)' },
			{ value: UnitType.FT, label: 'Feet (ft)' },
			{ value: UnitType.FT_IN, label: 'Feet & Inches (ft-in)' }
		];
	}
}

// Singleton instance
const units = new UnitsManager();

export { UnitType, units as default };
