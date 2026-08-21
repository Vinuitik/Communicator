# Chrono Service

A microservice responsible for applying daily decay to friend interaction metrics for friends who didn't have interactions.

## Purpose

This service optimizes the performance of analytics calculations by using a hybrid approach:
- **Real-time updates**: When friends interact, EMAs are updated immediately in the Friend Service
- **Daily decay**: At midnight, decay is applied only to friends who had no interactions yesterday

This reduces computational complexity from O(n) on every request to O(1) for retrieving pre-calculated values.

## Architecture

### Real-time Updates (Friend Service)
- When analytics is created → EMA values updated immediately
- Uses "newData" alpha coefficients for responsiveness
- Happens within the same transaction as analytics creation

### Daily Decay Process (Chrono Service)  
- Runs at 00:00 daily
- Checks each friend for yesterday's interactions
- If no interaction → applies decay using "decay" alpha coefficients
- If interaction occurred → skips (already updated in real-time)

## Features

- **Smart Decay**: Only decays when no interaction occurred
- **Event-driven Updates**: Real-time EMA updates on interaction
- **Experience-based Coefficients**: Different rates based on interaction quality
- **Manual Trigger**: Provides endpoint for testing

## Calculated Metrics

1. **Average Frequency**: How often you meet with each friend
2. **Average Duration**: Time spent per meeting  
3. **Average Excitement**: Quality/satisfaction rating of interactions

## Configuration

### Friend Service (Real-time updates)
Uses "newData" alpha coefficients in `application.yml`:
- Excellent (***): 0.6 - High responsiveness to good experiences
- Good (**): 0.7
- Poor (*): 0.8 - Even higher responsiveness to poor experiences

### Chrono Service (Decay)
Uses "decay" alpha coefficients in `application.yml`:
- Excellent (***): 0.07 - Very slow decay for good experiences  
- Good (**): 0.2
- Poor (*): 0.57 - Faster decay for poor experiences

## Data Flow

1. **User interacts with friend** → Analytics created
2. **Analytics Service** → Immediately updates EMA values (Friend Service)
3. **Next day at 00:00** → Chrono job checks yesterday's interactions
4. **For friends with no yesterday interaction** → Apply decay
5. **For friends with yesterday interaction** → Skip (already updated)

## API Endpoints

- `POST /chrono/trigger-decay`: Manual trigger for testing
- `POST /chrono/health`: Health check

## Performance Impact

- **Before**: O(n) calculation on each analytics request
- **After**: O(1) retrieval of pre-calculated values
- **Update Method**: Event-driven (immediate) + Daily decay
- **Processing**: Only friends needing decay are processed
