<template>
    <div class="relative inline-flex items-center justify-center rounded-full shrink-0" :class="sizeClasses">
        <img
            v-if="avatarUrl && !imgError"
            :src="avatarUrl"
            :alt="nickname"
            class="rounded-full object-cover w-full h-full"
            @error="imgError = true"
        />
        <div
            v-else
            class="w-full h-full rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center font-bold text-emerald-600 dark:text-emerald-400"
            :class="textSizeClass"
        >
            {{ nickname?.charAt(0)?.toUpperCase() }}
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
    nickname: { type: String, default: '' },
    avatarUrl: { type: String, default: null },
    size: { type: String, default: 'md', validator: v => ['xs', 'sm', 'md', 'lg', 'xl'].includes(v) },
});

const imgError = ref(false);

const sizeMap = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
    xl: 'w-20 h-20',
};

const textSizeMap = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-2xl',
    xl: 'text-3xl',
};

const sizeClasses = sizeMap[props.size];
const textSizeClass = textSizeMap[props.size];
</script>
