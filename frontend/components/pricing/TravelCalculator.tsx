/**
 * TravelCalculator - Travel Cost Calculator
 *
 * Calculates travel costs with trip details, per diem lookup,
 * mileage calculator, and detailed cost breakdown.
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import {
	Plane,
	MapPin,
	Users,
	Calendar,
	Car,
	Hotel,
	Utensils,
	Calculator,
	DollarSign,
	Search,
	Loader2,
	RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type { TravelDetails } from "@/lib/types/pricing";
import { lookupPerDiem, calculateTravelCosts } from "@/lib/actions/pricing";

// =============================================================================
// Types
// =============================================================================

export interface TravelCalculatorProps {
	/** Initial travel details */
	initialDetails?: Partial<TravelDetails>;
	/** Callback when calculation is complete */
	onCalculate: (cost: number, details: TravelDetails) => void;
	/** Additional CSS classes */
	className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_MILEAGE_RATE = 0.67; // IRS 2024 rate

// =============================================================================
// Utility Functions
// =============================================================================

function formatCurrency(value: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(value);
}

// =============================================================================
// Main Component
// =============================================================================

export function TravelCalculator({
	initialDetails,
	onCalculate,
	className,
}: TravelCalculatorProps) {
	// Form state
	const [tripPurpose, setTripPurpose] = useState(initialDetails?.tripPurpose || "");
	const [origin, setOrigin] = useState(initialDetails?.origin || "");
	const [destination, setDestination] = useState(initialDetails?.destination || "");
	const [travelers, setTravelers] = useState(initialDetails?.travelers || 1);
	const [trips, setTrips] = useState(initialDetails?.trips || 1);
	const [daysPerTrip, setDaysPerTrip] = useState(initialDetails?.daysPerTrip || 1);
	const [airfare, setAirfare] = useState(initialDetails?.airfare || 0);
	const [perDiem, setPerDiem] = useState(initialDetails?.perDiem || 0);
	const [lodging, setLodging] = useState(initialDetails?.lodging || 0);
	const [mileage, setMileage] = useState(initialDetails?.mileage || 0);
	const [mileageRate, setMileageRate] = useState(initialDetails?.mileageRate || DEFAULT_MILEAGE_RATE);
	const [otherCosts, setOtherCosts] = useState(initialDetails?.otherCosts || 0);

	const [isLookingUp, setIsLookingUp] = useState(false);

	// Calculate costs
	const costs = useMemo(() => {
		const airfareCost = airfare * travelers * trips;
		const lodgingCost = lodging * (daysPerTrip - 1) * travelers * trips; // Nights = days - 1
		const perDiemCost = perDiem * daysPerTrip * travelers * trips;
		const mileageCost = mileage * mileageRate * trips;
		const otherCostTotal = otherCosts * travelers * trips;

		const total = airfareCost + lodgingCost + perDiemCost + mileageCost + otherCostTotal;

		return {
			airfare: airfareCost,
			lodging: lodgingCost,
			perDiem: perDiemCost,
			mileage: mileageCost,
			other: otherCostTotal,
			total,
		};
	}, [airfare, lodging, perDiem, mileage, mileageRate, otherCosts, travelers, trips, daysPerTrip]);

	// Handle per diem lookup
	const handleLookupPerDiem = useCallback(async () => {
		if (!destination) return;

		setIsLookingUp(true);
		const result = await lookupPerDiem(destination);
		if (result.success && result.data) {
			setLodging(result.data.lodging);
			setPerDiem(result.data.meals + result.data.incidentals);
		}
		setIsLookingUp(false);
	}, [destination]);

	// Handle calculate/apply
	const handleCalculate = useCallback(() => {
		const details: TravelDetails = {
			tripPurpose,
			origin,
			destination,
			travelers,
			trips,
			daysPerTrip,
			airfare,
			perDiem,
			lodging,
			mileage,
			mileageRate,
			otherCosts,
			totalCost: costs.total,
		};
		onCalculate(costs.total, details);
	}, [
		tripPurpose,
		origin,
		destination,
		travelers,
		trips,
		daysPerTrip,
		airfare,
		perDiem,
		lodging,
		mileage,
		mileageRate,
		otherCosts,
		costs.total,
		onCalculate,
	]);

	// Handle reset
	const handleReset = useCallback(() => {
		setTripPurpose("");
		setOrigin("");
		setDestination("");
		setTravelers(1);
		setTrips(1);
		setDaysPerTrip(1);
		setAirfare(0);
		setPerDiem(0);
		setLodging(0);
		setMileage(0);
		setMileageRate(DEFAULT_MILEAGE_RATE);
		setOtherCosts(0);
	}, []);

	return (
		<Card className={cn("w-full", className)}>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Plane className="h-5 w-5" />
					Travel Cost Calculator
				</CardTitle>
			</CardHeader>

			<CardContent className="space-y-6">
				{/* Trip Details */}
				<div className="space-y-4">
					<h4 className="text-sm font-medium flex items-center gap-2">
						<Calendar className="h-4 w-4" />
						Trip Details
					</h4>

					{/* Purpose */}
					<div className="space-y-2">
						<Label htmlFor="tripPurpose">Trip Purpose</Label>
						<Input
							id="tripPurpose"
							value={tripPurpose}
							onChange={(e) => setTripPurpose(e.target.value)}
							placeholder="e.g., Kickoff meeting, site visit"
						/>
					</div>

					{/* Locations */}
					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label htmlFor="origin">
								<MapPin className="h-3 w-3 inline mr-1" />
								Origin
							</Label>
							<Input
								id="origin"
								value={origin}
								onChange={(e) => setOrigin(e.target.value)}
								placeholder="Departure city"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="destination">
								<MapPin className="h-3 w-3 inline mr-1" />
								Destination
							</Label>
							<div className="flex gap-2">
								<Input
									id="destination"
									value={destination}
									onChange={(e) => setDestination(e.target.value)}
									placeholder="Arrival city"
								/>
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												variant="outline"
												size="icon"
												onClick={handleLookupPerDiem}
												disabled={isLookingUp || !destination}
												aria-label="Look up per diem rates"
											>
												{isLookingUp ? (
													<Loader2 className="h-4 w-4 animate-spin" />
												) : (
													<Search className="h-4 w-4" />
												)}
											</Button>
										</TooltipTrigger>
										<TooltipContent>
											<p>Look up GSA per diem rates</p>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							</div>
						</div>
					</div>

					{/* Trip Parameters */}
					<div className="grid grid-cols-3 gap-4">
						<div className="space-y-2">
							<Label htmlFor="travelers">
								<Users className="h-3 w-3 inline mr-1" />
								Travelers
							</Label>
							<Input
								id="travelers"
								type="number"
								min="1"
								value={travelers}
								onChange={(e) => setTravelers(parseInt(e.target.value) || 1)}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="trips">Number of Trips</Label>
							<Input
								id="trips"
								type="number"
								min="1"
								value={trips}
								onChange={(e) => setTrips(parseInt(e.target.value) || 1)}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="daysPerTrip">Days per Trip</Label>
							<Input
								id="daysPerTrip"
								type="number"
								min="1"
								value={daysPerTrip}
								onChange={(e) => setDaysPerTrip(parseInt(e.target.value) || 1)}
							/>
						</div>
					</div>
				</div>

				<Separator />

				{/* Cost Inputs */}
				<div className="space-y-4">
					<h4 className="text-sm font-medium flex items-center gap-2">
						<DollarSign className="h-4 w-4" />
						Cost Inputs (per person/trip)
					</h4>

					<div className="grid grid-cols-2 gap-4">
						{/* Airfare */}
						<div className="space-y-2">
							<Label htmlFor="airfare">
								<Plane className="h-3 w-3 inline mr-1" />
								Airfare
							</Label>
							<div className="relative">
								<DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<Input
									id="airfare"
									type="number"
									min="0"
									step="0.01"
									value={airfare || ""}
									onChange={(e) => setAirfare(parseFloat(e.target.value) || 0)}
									className="pl-9"
									placeholder="0.00"
								/>
							</div>
						</div>

						{/* Lodging */}
						<div className="space-y-2">
							<Label htmlFor="lodging">
								<Hotel className="h-3 w-3 inline mr-1" />
								Lodging (per night)
							</Label>
							<div className="relative">
								<DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<Input
									id="lodging"
									type="number"
									min="0"
									step="0.01"
									value={lodging || ""}
									onChange={(e) => setLodging(parseFloat(e.target.value) || 0)}
									className="pl-9"
									placeholder="0.00"
								/>
							</div>
						</div>

						{/* Per Diem */}
						<div className="space-y-2">
							<Label htmlFor="perDiem">
								<Utensils className="h-3 w-3 inline mr-1" />
								Per Diem (per day)
							</Label>
							<div className="relative">
								<DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<Input
									id="perDiem"
									type="number"
									min="0"
									step="0.01"
									value={perDiem || ""}
									onChange={(e) => setPerDiem(parseFloat(e.target.value) || 0)}
									className="pl-9"
									placeholder="0.00"
								/>
							</div>
						</div>

						{/* Other */}
						<div className="space-y-2">
							<Label htmlFor="otherCosts">Other Costs</Label>
							<div className="relative">
								<DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<Input
									id="otherCosts"
									type="number"
									min="0"
									step="0.01"
									value={otherCosts || ""}
									onChange={(e) => setOtherCosts(parseFloat(e.target.value) || 0)}
									className="pl-9"
									placeholder="0.00"
								/>
							</div>
						</div>
					</div>

					{/* Mileage */}
					<div className="p-3 border rounded-lg space-y-3">
						<Label className="flex items-center gap-1">
							<Car className="h-3 w-3" />
							Mileage (if driving)
						</Label>
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor="mileage" className="text-xs text-muted-foreground">
									Total Miles
								</Label>
								<Input
									id="mileage"
									type="number"
									min="0"
									value={mileage || ""}
									onChange={(e) => setMileage(parseFloat(e.target.value) || 0)}
									placeholder="0"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="mileageRate" className="text-xs text-muted-foreground">
									Rate per Mile
								</Label>
								<div className="relative">
									<DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
									<Input
										id="mileageRate"
										type="number"
										min="0"
										step="0.01"
										value={mileageRate}
										onChange={(e) => setMileageRate(parseFloat(e.target.value) || DEFAULT_MILEAGE_RATE)}
										className="pl-9"
									/>
								</div>
							</div>
						</div>
					</div>
				</div>

				<Separator />

				{/* Cost Breakdown */}
				<div className="space-y-3">
					<h4 className="text-sm font-medium flex items-center gap-2">
						<Calculator className="h-4 w-4" />
						Cost Breakdown
					</h4>

					<div className="p-4 bg-muted/50 rounded-lg space-y-2">
						<div className="flex justify-between text-sm">
							<span className="text-muted-foreground">Airfare</span>
							<span>
								{formatCurrency(airfare)} x {travelers} x {trips} = {formatCurrency(costs.airfare)}
							</span>
						</div>
						<div className="flex justify-between text-sm">
							<span className="text-muted-foreground">Lodging</span>
							<span>
								{formatCurrency(lodging)} x {daysPerTrip - 1} nights x {travelers} x {trips} = {formatCurrency(costs.lodging)}
							</span>
						</div>
						<div className="flex justify-between text-sm">
							<span className="text-muted-foreground">Per Diem</span>
							<span>
								{formatCurrency(perDiem)} x {daysPerTrip} days x {travelers} x {trips} = {formatCurrency(costs.perDiem)}
							</span>
						</div>
						{costs.mileage > 0 && (
							<div className="flex justify-between text-sm">
								<span className="text-muted-foreground">Mileage</span>
								<span>
									{mileage} mi x {formatCurrency(mileageRate)} x {trips} = {formatCurrency(costs.mileage)}
								</span>
							</div>
						)}
						{costs.other > 0 && (
							<div className="flex justify-between text-sm">
								<span className="text-muted-foreground">Other</span>
								<span>{formatCurrency(costs.other)}</span>
							</div>
						)}
						<Separator className="my-2" />
						<div className="flex justify-between font-semibold">
							<span>Total Travel Cost</span>
							<span className="text-lg">{formatCurrency(costs.total)}</span>
						</div>
					</div>
				</div>

				{/* Actions */}
				<div className="flex items-center justify-end gap-2">
					<Button variant="outline" onClick={handleReset}>
						<RefreshCw className="h-4 w-4 mr-2" />
						Reset
					</Button>
					<Button onClick={handleCalculate}>
						<Calculator className="h-4 w-4 mr-2" />
						Apply to Cost Element
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

export default TravelCalculator;
