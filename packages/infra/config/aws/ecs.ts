/**
 * 512 (0.5 GB), 1024 (1 GB), 2048 (2 GB) - Available cpu values: 256 (.25 vCPU)
 *
 * 1024 (1 GB), 2048 (2 GB), 3072 (3 GB), 4096 (4 GB) - Available cpu values: 512 (.5 vCPU)
 *
 * 2048 (2 GB), 3072 (3 GB), 4096 (4 GB), 5120 (5 GB), 6144 (6 GB), 7168 (7 GB), 8192 (8 GB) - Available cpu values: 1024 (1 vCPU)
 *
 * Between 4096 (4 GB) and 16384 (16 GB) in increments of 1024 (1 GB) - Available cpu values: 2048 (2 vCPU)
 *
 * Between 8192 (8 GB) and 30720 (30 GB) in increments of 1024 (1 GB) - Available cpu values: 4096 (4 vCPU)
 *
 * Between 16384 (16 GB) and 61440 (60 GB) in increments of 4096 (4 GB) - Available cpu values: 8192 (8 vCPU)
 *
 * Between 32768 (32 GB) and 122880 (120 GB) in increments of 8192 (8 GB) - Available cpu values: 16384 (16 vCPU)
 */
export type ECS_MEMORY = number;

/**
 * 256 (.25 vCPU) - Available memory values: 0.5GB, 1GB, 2GB
 *
 * 512 (.5 vCPU) - Available memory values: 1GB, 2GB, 3GB, 4GB
 *
 * 1024 (1 vCPU) - Available memory values: 2GB, 3GB, 4GB, 5GB, 6GB, 7GB, 8GB
 *
 * 2048 (2 vCPU) - Available memory values: Between 4GB and 16GB in 1GB increments
 *
 * 4096 (4 vCPU) - Available memory values: Between 8GB and 30GB in 1GB increments
 *
 * 8192 (8 vCPU) - Available memory values: Between 16GB and 60GB in 4GB increments
 *
 * 16384 (16 vCPU) - Available memory values: Between 32GB and 120GB in 8GB increments
 */
export type ECS_CPU = number;
