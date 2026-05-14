<template>
  <!-- components/MovementGraph.vue -->
  <div class="graph-wrapper">
    <canvas ref="canvasRef" />
    <p v-if="!hasSeries" class="no-data">No sessions recorded for this movement yet.</p>
  </div>
</template>

<script setup lang="ts">
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import 'chartjs-adapter-date-fns'

// Register only what we need (tree-shakeable)
Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Tooltip,
  Legend,
  Filler,
)

interface DataPoint {
  date: Date
  leftAngle: number | null
  rightAngle: number | null
}

const props = defineProps<{
  series: DataPoint[]
  movementLabel: string
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

const hasSeries = computed(() => props.series.length > 0)

// ─── Build Chart.js datasets ───────────────────────────────────────────────

function buildDatasets() {
  const leftData = props.series
    .filter((p) => p.leftAngle !== null)
    .map((p) => ({ x: p.date.getTime(), y: p.leftAngle as number }))

  const rightData = props.series
    .filter((p) => p.rightAngle !== null)
    .map((p) => ({ x: p.date.getTime(), y: p.rightAngle as number }))

  const datasets = []

  if (leftData.length) {
    datasets.push({
      label: 'Left Arm',
      data: leftData,
      borderColor: '#4a9eff',
      backgroundColor: 'rgba(74, 158, 255, 0.08)',
      pointBackgroundColor: '#4a9eff',
      pointRadius: 5,
      pointHoverRadius: 7,
      tension: 0.35,
      fill: false,
    })
  }

  if (rightData.length) {
    datasets.push({
      label: 'Right Arm',
      data: rightData,
      borderColor: '#ff7c4a',
      backgroundColor: 'rgba(255, 124, 74, 0.08)',
      pointBackgroundColor: '#ff7c4a',
      pointRadius: 5,
      pointHoverRadius: 7,
      tension: 0.35,
      fill: false,
    })
  }

  return datasets
}

function renderChart() {
  if (!canvasRef.value || !hasSeries.value) return

  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }

  chartInstance = new Chart(canvasRef.value, {
    type: 'line',
    data: { datasets: buildDatasets() },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: 'var(--color-text, #1a1a2e)',
            font: { size: 13, family: 'inherit' },
            usePointStyle: true,
            pointStyleWidth: 10,
          },
        },
        tooltip: {
          backgroundColor: 'var(--color-surface, #fff)',
          titleColor: 'var(--color-text, #1a1a2e)',
          bodyColor: 'var(--color-text-muted, #555)',
          borderColor: 'var(--color-border, #e0e0e0)',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y}°`,
          },
        },
      },
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'day',
            tooltipFormat: 'dd MMM yyyy HH:mm',
            displayFormats: { day: 'dd MMM' },
          },
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: { color: 'var(--color-text-muted, #777)', maxRotation: 30 },
        },
        y: {
          min: 0,
          max: 180,
          title: {
            display: true,
            text: 'Angle (°)',
            color: 'var(--color-text-muted, #777)',
          },
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: {
            color: 'var(--color-text-muted, #777)',
            callback: (v) => `${v}°`,
          },
        },
      },
    },
  })
}

onMounted(renderChart)
watch(() => props.series, renderChart, { deep: true })
onUnmounted(() => chartInstance?.destroy())
</script>

<style scoped>
.graph-wrapper {
  position: relative;
  width: 100%;
}

.no-data {
  text-align: center;
  color: var(--color-text-muted, #888);
  font-size: 0.9rem;
  padding: 2rem 0;
}
</style>